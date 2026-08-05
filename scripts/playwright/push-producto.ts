import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { FrameLocator, Page } from "playwright";
import { abrirSesion } from "./finnegans-login";
import {
  PRODUCTOS_VIEW_URL,
  IFRAME_SELECTOR,
  ACCIONES,
  WIDGETS,
  WIDGETS_CHECK,
  ESPERA_MS,
  RESULTADOS_DIR,
  campoSelector,
} from "./config";

// Da de alta UN producto en Finnegans Go vía Playwright.
//
// Este módulo exporta la lógica reutilizable para el microservicio worker
// (worker/index.ts), que hace polling de FinnegansPushJob en Postgres:
//   - reclamarJob():  transición atómica PENDIENTE → EN_PROCESO
//   - procesarJob():  corre el alta y deja el job en SINCRONIZADO o ERROR
//
// También puede ejecutarse a mano para depurar un job puntual:
//   npx tsx scripts/playwright/push-producto.ts <jobId>
//
// Flujo verificado: docs/carga-productos-playwright.md §5.2

const HEADLESS = process.env.FINNEGANS_PUSH_HEADLESS !== "false";

// ───────────────────────────────────────────────────────────── helpers UI ──

/** Pausa corta: el form legacy hace postbacks tras cada interacción. */
function respirar(page: Page, factor = 1) {
  return page.waitForTimeout(ESPERA_MS * factor);
}

async function llenar(frame: FrameLocator, widget: string, valor: string | null | undefined) {
  if (valor == null || valor === "") return;
  await frame.locator(campoSelector(widget)).first().fill(String(valor));
}

/** Marca un checkbox por el nombre de su widget contenedor (verificado). */
async function marcarCheckbox(
  frame: FrameLocator,
  widget: string,
  etiqueta: string,
  avisos: string[],
) {
  try {
    const loc = frame.locator(campoSelector(widget)).first();
    await loc.waitFor({ state: "visible", timeout: 5000 });
    await loc.check({ timeout: 5000 });
  } catch {
    // No abortamos el alta por un checkbox: queda el aviso en el log del job.
    avisos.push(`No pude marcar "${etiqueta}" (${widget}).`);
  }
}

// ─────────────────────────────────────────────────────────────── claim ──

/**
 * Reclama el job para este proceso: PENDIENTE → EN_PROCESO de forma atómica.
 * El `updateMany` condicionado por estado garantiza que si dos consumidores
 * compiten por el mismo job, solo uno ve count === 1. (Con N réplicas y alta
 * contención, el patrón canónico en Postgres sería `SELECT ... FOR UPDATE
 * SKIP LOCKED` vía $queryRaw; con un solo worker esto alcanza y es portable.)
 */
export async function reclamarJob(prisma: PrismaClient, jobId: string): Promise<boolean> {
  const claim = await prisma.finnegansPushJob.updateMany({
    where: { id: jobId, estado: "PENDIENTE" },
    data: { estado: "EN_PROCESO", startedAt: new Date() },
  });
  if (claim.count !== 1) return false;

  const job = await prisma.finnegansPushJob.findUnique({
    where: { id: jobId },
    select: { productoId: true },
  });
  if (job) {
    await prisma.producto.update({
      where: { id: job.productoId },
      data: { finnegansPushEstado: "EN_PROCESO" },
    });
  }
  return true;
}

// ─────────────────────────────────────────────────────────────── proceso ──

/**
 * Corre el alta del producto del job en Finnegans Go y persiste el resultado.
 * Precondición: el job ya fue reclamado (está EN_PROCESO).
 * No lanza por errores del alta: los deja asentados en el job (estado ERROR).
 * Devuelve el estado final para que el llamador loguee/decida.
 */
export async function procesarJob(
  prisma: PrismaClient,
  jobId: string,
): Promise<"SINCRONIZADO" | "ERROR"> {
  const job = await prisma.finnegansPushJob.findUnique({
    where: { id: jobId },
    include: { producto: true },
  });
  if (!job) throw new Error(`No existe el job ${jobId}`);
  const p = job.producto;

  // Local al job: en el worker long-running un array a nivel módulo se
  // acumularía entre jobs.
  const avisos: string[] = [];

  let browser: Awaited<ReturnType<typeof abrirSesion>>["browser"] | null = null;
  let page: Page | null = null;

  try {
    if (!p.teamplaceCodigo) throw new Error("El producto no tiene código de Finnegans.");

    const sesion = await abrirSesion({ headless: HEADLESS });
    browser = sesion.browser;
    page = sesion.page;

    await page.goto(PRODUCTOS_VIEW_URL, { waitUntil: "domcontentloaded" });
    const frame = page.frameLocator(IFRAME_SELECTOR);

    // Abrir el formulario de alta
    await frame.getByRole("link", { name: ACCIONES.nuevo, exact: true }).first().waitFor({ timeout: 30_000 });
    await frame.getByRole("link", { name: ACCIONES.nuevo, exact: true }).first().click();
    await frame.locator(campoSelector(WIDGETS.codigo)).first().waitFor({ state: "visible", timeout: 20_000 });
    await respirar(page); // el form termina de montarse

    // Campos de texto (Código y Nombre son los obligatorios; Tipo ya trae "Otros")
    await llenar(frame, WIDGETS.codigo, p.teamplaceCodigo);
    await llenar(frame, WIDGETS.nombre, p.nombre);
    await llenar(frame, WIDGETS.descripcion, p.descripcion);
    if (p.finnegansTipo && p.finnegansTipo !== "Otros") {
      await llenar(frame, WIDGETS.tipo, p.finnegansTipo);
    }
    if (Number(p.finnegansPeso) > 0) await llenar(frame, WIDGETS.peso, String(p.finnegansPeso));
    if (Number(p.finnegansVolumen) > 0) await llenar(frame, WIDGETS.volumen, String(p.finnegansVolumen));
    await llenar(frame, WIDGETS.rubro, p.finnegansRubro);
    await llenar(frame, WIDGETS.marca, p.finnegansMarca);
    await llenar(frame, WIDGETS.familia, p.finnegansFamilia);
    await llenar(frame, WIDGETS.subfamilia, p.finnegansSubFamilia);

    // Checkboxes
    if (p.finnegansActivo) await marcarCheckbox(frame, WIDGETS_CHECK.activo, "Activo", avisos);
    if (p.esStockeable) await marcarCheckbox(frame, WIDGETS_CHECK.esStockeable, "Es Stockeable", avisos);
    if (p.seVende) await marcarCheckbox(frame, WIDGETS_CHECK.seVende, "Se Vende", avisos);
    if (p.seCompra) await marcarCheckbox(frame, WIDGETS_CHECK.seCompra, "Se Compra", avisos);
    if (p.manejaRetenciones) {
      await marcarCheckbox(frame, WIDGETS_CHECK.manejaRetenciones, "Maneja Retenciones", avisos);
    }

    await respirar(page); // dejamos asentar los valores antes de guardar

    // Guardar. `exact: true` es CRÍTICO: sin él "Guardar" también matchea
    // "Guardar y nuevo", que guarda y abre un form vacío (y rompe la verificación).
    await frame.getByRole("link", { name: ACCIONES.guardar, exact: true }).last().click();
    await respirar(page);

    // Éxito = aparece "Eliminar" (solo existe en registros ya guardados).
    await frame.getByRole("link", { name: ACCIONES.eliminar, exact: true }).first().waitFor({
      state: "visible",
      timeout: 30_000,
    });

    const log = [`Creado "${p.teamplaceCodigo}" en Finnegans Go.`, ...avisos].join(" | ");

    // Condicionado a EN_PROCESO: si otro actor ya cerró el job (p.ej. el
    // timeout del worker lo marcó ERROR), no pisamos ese resultado.
    await prisma.finnegansPushJob.updateMany({
      where: { id: jobId, estado: "EN_PROCESO" },
      data: { estado: "SINCRONIZADO", finishedAt: new Date(), log, error: null },
    });
    await prisma.producto.update({
      where: { id: p.id },
      data: {
        finnegansPushEstado: "SINCRONIZADO",
        finnegansPushAt: new Date(),
        finnegansPushError: null,
        teamplaceSyncAt: new Date(),
      },
    });
    console.log("✔", log);
    return "SINCRONIZADO";
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    // Captura para diagnosticar qué vio el bot.
    let shot: string | null = null;
    if (page) {
      shot = `${RESULTADOS_DIR}/push-error-${jobId}.png`;
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {
        shot = null;
      });
    }
    const detalle = [error, ...avisos, shot ? `Captura: ${shot}` : ""].filter(Boolean).join(" | ");

    await prisma.finnegansPushJob.updateMany({
      where: { id: jobId, estado: "EN_PROCESO" },
      data: { estado: "ERROR", finishedAt: new Date(), error: detalle },
    });
    await prisma.producto.update({
      where: { id: p.id },
      data: { finnegansPushEstado: "ERROR", finnegansPushError: detalle },
    });
    console.error("✖", detalle);
    return "ERROR";
  } finally {
    await browser?.close().catch(() => {});
  }
}

// ──────────────────────────────────────────────────────── CLI (debug) ──

async function main() {
  const jobId = process.argv[2];
  if (!jobId) throw new Error("Falta el jobId. Uso: tsx push-producto.ts <jobId>");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const reclamado = await reclamarJob(prisma, jobId);
    if (!reclamado) {
      throw new Error(
        `El job ${jobId} no está PENDIENTE (¿ya lo tomó el worker o ya terminó?).`,
      );
    }
    const estado = await procesarJob(prisma, jobId);
    if (estado === "ERROR") process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecución directa (mismo patrón que finnegans-login.ts): al importarse desde
// el worker, este bloque no corre.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("push-producto.ts")) {
  main().catch((e) => {
    console.error("Error fatal:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
