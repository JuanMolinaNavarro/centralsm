import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname } from "node:path";
import type { FrameLocator, Page } from "playwright";
import { abrirSesion } from "./finnegans-login";
import {
  PRODUCTOS_VIEW_URL,
  IFRAME_SELECTOR,
  WIDGETS,
  ACCIONES,
  ESPERA_MS,
  campoSelector,
} from "./config";

// Bot de carga de productos por la UI de Finnegans Go (Playwright).
// Flujo VERIFICADO (2026-07-23, workspace MULTIMEDIOS):
//   login → /mas/vista?viewID=104 (maestro Productos, dentro de un <iframe>)
//   → link "Nuevo" → form legacy JSP → completar por tabindex → "Guardar y nuevo"
//
// Uso:
//   tsx scripts/playwright/cargar-productos-ui.ts <archivo.json|.csv> [--headless] [--dry-run]
//
// --dry-run: completa el formulario pero NO guarda (para validar sin crear datos).
//
// Doc: docs/carga-productos-playwright.md · Config: scripts/playwright/config.ts

type Producto = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo?: string;
  peso?: string | number;
  volumen?: string | number;
  rubro?: string;
  marca?: string;
  familia?: string;
  subfamilia?: string;
};

type Resultado = { codigo: string; nombre: string; ok: boolean; estado: string; error?: string };

const OUT_DIR = "scripts/playwright/resultados";

// ─────────────────────────────────────────────────────────────── entrada ──

function leerProductos(path: string): Producto[] {
  const raw = readFileSync(path, "utf8");
  const rows = extname(path).toLowerCase() === ".csv" ? parseCSV(raw) : (JSON.parse(raw) as Producto[]);
  return rows.map((r, i) => {
    if (!r.codigo || !r.nombre) {
      throw new Error(`Fila ${i + 1}: faltan 'codigo' y/o 'nombre' (${JSON.stringify(r)})`);
    }
    return r;
  });
}

/** CSV mínimo con soporte de comillas y comas dentro de campos. Primera fila = headers. */
function parseCSV(text: string): Producto[] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); campo = ""; fila = []; }
    else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  const [headers, ...resto] = filas.filter((f) => f.some((x) => x.trim() !== ""));
  return resto.map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h.trim()] = (cols[idx] ?? "").trim()));
    return obj as unknown as Producto;
  });
}

// ─────────────────────────────────────────────────────── operaciones UI ──

/** Abre un formulario de alta vacío (click en "Nuevo" dentro del iframe). */
async function abrirNuevo(frame: FrameLocator, page: Page) {
  await frame.getByRole("link", { name: ACCIONES.nuevo, exact: true }).first().click();
  await frame
    .locator(campoSelector(WIDGETS.codigo))
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(ESPERA_MS);
}

/** Completa los campos del producto. Los F4 (Rubro/Marca/…) son best-effort. */
async function completar(frame: FrameLocator, p: Producto) {
  const set = async (widget: string, valor: unknown) => {
    if (valor == null || valor === "") return;
    await frame.locator(campoSelector(widget)).first().fill(String(valor));
  };

  await set(WIDGETS.codigo, p.codigo);
  await set(WIDGETS.nombre, p.nombre);
  await set(WIDGETS.descripcion, p.descripcion);
  if (p.tipo && p.tipo !== "Otros") await set(WIDGETS.tipo, p.tipo);
  await set(WIDGETS.peso, p.peso);
  await set(WIDGETS.volumen, p.volumen);
  // F4: se tipea y se confirma con Enter para elegir la primera coincidencia.
  for (const [campo, widget] of [
    ["rubro", WIDGETS.rubro],
    ["marca", WIDGETS.marca],
    ["familia", WIDGETS.familia],
    ["subfamilia", WIDGETS.subfamilia],
  ] as const) {
    const valor = (p as Record<string, unknown>)[campo];
    if (valor == null || valor === "") continue;
    const input = frame.locator(campoSelector(widget)).first();
    await input.fill(String(valor));
    await input.press("Enter");
  }
}

/**
 * Guarda el producto. `exact: true` es CRÍTICO: sin él "Guardar" también
 * matchea "Guardar y nuevo" (match por substring) y se aprieta el botón equivocado.
 */
async function guardar(frame: FrameLocator, page: Page): Promise<void> {
  await page.waitForTimeout(ESPERA_MS);
  await frame.getByRole("link", { name: ACCIONES.guardar, exact: true }).last().click();
  await page.waitForTimeout(ESPERA_MS);
  // Éxito = aparece "Eliminar" (solo existe en registros ya guardados).
  await frame
    .getByRole("link", { name: ACCIONES.eliminar, exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}

/** Cierra el form descartando cambios (responde "No" al diálogo si aparece). */
async function cerrarDescartando(frame: FrameLocator, page: Page) {
  await frame.getByRole("link", { name: ACCIONES.cerrar }).last().click().catch(() => {});
  await page.waitForTimeout(500);
  await frame.getByText(ACCIONES.dialogoNo, { exact: true }).click({ timeout: 3000 }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────── utils ──

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// ──────────────────────────────────────────────────────────────── main ──

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith("--")) ?? "scripts/playwright/productos.example.json";
  const headless = args.includes("--headless");
  const dryRun = args.includes("--dry-run");

  const productos = leerProductos(path);
  console.log(`Cargando ${productos.length} productos desde ${path}${dryRun ? " (DRY-RUN, no guarda)" : ""}\n`);

  const { browser, page } = await abrirSesion({ headless });
  mkdirSync(OUT_DIR, { recursive: true });

  await page.goto(PRODUCTOS_VIEW_URL, { waitUntil: "domcontentloaded" });
  const frame = page.frameLocator(IFRAME_SELECTOR);
  await frame
    .getByRole("link", { name: ACCIONES.nuevo, exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });

  const resultados: Resultado[] = [];
  for (const prod of productos) {
    const base = { codigo: prod.codigo, nombre: prod.nombre };
    try {
      await abrirNuevo(frame, page);
      await completar(frame, prod);

      if (dryRun) {
        const shot = `${OUT_DIR}/dryrun-${prod.codigo}-${stamp()}.png`;
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        await cerrarDescartando(frame, page);
        resultados.push({ ...base, ok: true, estado: "dry-run-ok" });
        console.log(`◻ ${prod.codigo} — form completado (dry-run, no guardado)`);
      } else {
        await guardar(frame, page);
        // Volvemos a la grilla para encarar el próximo alta desde un estado limpio.
        await cerrarDescartando(frame, page);
        resultados.push({ ...base, ok: true, estado: "creado" });
        console.log(`✔ ${prod.codigo} — ${prod.nombre}`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const shot = `${OUT_DIR}/error-${prod.codigo}-${stamp()}.png`;
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      resultados.push({ ...base, ok: false, estado: "error", error });
      console.error(`✖ ${prod.codigo} — ${error}  (captura: ${shot})`);
      // Intentamos volver a un estado limpio para el siguiente producto.
      await cerrarDescartando(frame, page).catch(() => {});
    }
  }

  const okCount = resultados.filter((r) => r.ok).length;
  const reporte = `${OUT_DIR}/resultado-${stamp()}.json`;
  writeFileSync(reporte, JSON.stringify(resultados, null, 2), "utf8");

  console.log(`\n──────── Resumen ────────`);
  console.log(`OK:      ${okCount}/${resultados.length}`);
  console.log(`Errores: ${resultados.length - okCount}`);
  console.log(`Reporte: ${reporte}`);

  await browser.close();
  if (okCount < resultados.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Error fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
