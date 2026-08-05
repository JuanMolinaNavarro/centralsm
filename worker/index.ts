import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { procesarJob, reclamarJob } from "../scripts/playwright/push-producto";

// Worker de Finnegans: microservicio que da de alta productos en Finnegans Go.
//
// Patrón: DB-as-queue. La app Next.js solo inserta FinnegansPushJob en estado
// PENDIENTE (src/lib/finnegans-push.ts); este proceso hace polling de la tabla,
// reclama los jobs de a uno (Chromium es pesado y la sesión del bot no se
// comparte) y los procesa con Playwright. La UI sigue consultando la misma
// tabla por polling, así que no necesita saber que esto existe.
//
// Correr local:  npm run worker   (DATABASE_URL apuntando a localhost:5433)
// En contenedor: servicio `worker` de docker-compose / Deployment de k8s.

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 4000);
const JOB_TIMEOUT_MS = Number(process.env.WORKER_JOB_TIMEOUT_MS ?? 5 * 60 * 1000);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─────────────────────────────────────────────────────── apagado prolijo ──
// SIGTERM es lo que manda Docker/Kubernetes al parar el contenedor (compose
// stop, kubectl rollout restart...). Si estamos idle salimos ya; si hay un job
// en curso lo terminamos y recién ahí salimos. El terminationGracePeriodSeconds
// del Deployment tiene que dar margen para eso.

let apagando = false;
let despertar: (() => void) | null = null;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      despertar = null;
      resolve();
    }, ms);
    despertar = () => {
      clearTimeout(timer);
      despertar = null;
      resolve();
    };
  });
}

function pedirApagado(senal: string) {
  if (apagando) return;
  apagando = true;
  console.log(`[worker] Recibí ${senal}: termino el job en curso (si hay) y salgo.`);
  despertar?.(); // aborta el sleep para salir sin esperar el próximo tick
}

process.on("SIGTERM", () => pedirApagado("SIGTERM"));
process.on("SIGINT", () => pedirApagado("SIGINT"));

// ────────────────────────────────────────────────────────────── huérfanos ──

/**
 * Jobs EN_PROCESO al arrancar son de una corrida anterior que murió (deploy,
 * crash, pod reprogramado). Los marcamos ERROR en vez de re-encolarlos: el
 * alta pudo haberse completado en Finnegans antes de morir el proceso, y
 * reintentarla a ciegas crearía un producto duplicado. El reintento es manual
 * (botón "Reintentar" en /productos), previa verificación en Finnegans.
 */
async function recuperarHuerfanos() {
  const huerfanos = await prisma.finnegansPushJob.findMany({
    where: { estado: "EN_PROCESO" },
    select: { id: true, productoId: true },
  });
  for (const job of huerfanos) {
    const error =
      "El worker se reinició mientras corría este job; verificá en Finnegans " +
      "si el producto quedó creado antes de reintentar.";
    await prisma.finnegansPushJob.update({
      where: { id: job.id },
      data: { estado: "ERROR", error, finishedAt: new Date() },
    });
    await prisma.producto.update({
      where: { id: job.productoId },
      data: { finnegansPushEstado: "ERROR", finnegansPushError: error },
    });
    console.warn(`[worker] Job huérfano ${job.id} marcado ERROR.`);
  }
}

// ─────────────────────────────────────────────────────────── claim + loop ──

/** Toma el job PENDIENTE más viejo. Devuelve null si no hay (o si otro ganó). */
async function reclamarSiguiente(): Promise<string | null> {
  const candidato = await prisma.finnegansPushJob.findFirst({
    where: { estado: "PENDIENTE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidato) return null;
  // reclamarJob es atómico: si otro consumidor se lo llevó entre el findFirst
  // y acá, devuelve false y este tick queda vacío (el próximo reintenta).
  return (await reclamarJob(prisma, candidato.id)) ? candidato.id : null;
}

/** Cierre por timeout: solo si el job sigue EN_PROCESO (no pisa resultados). */
async function marcarTimeout(jobId: string) {
  const error = `El worker superó el tiempo máximo (${Math.round(JOB_TIMEOUT_MS / 1000)}s) procesando este job.`;
  const cerrado = await prisma.finnegansPushJob.updateMany({
    where: { id: jobId, estado: "EN_PROCESO" },
    data: { estado: "ERROR", error, finishedAt: new Date() },
  });
  if (cerrado.count !== 1) return;
  const job = await prisma.finnegansPushJob.findUnique({
    where: { id: jobId },
    select: { productoId: true },
  });
  if (job) {
    await prisma.producto.update({
      where: { id: job.productoId },
      data: { finnegansPushEstado: "ERROR", finnegansPushError: error },
    });
  }
}

async function procesarConTimeout(jobId: string) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"TIMEOUT">((resolve) => {
    timer = setTimeout(() => resolve("TIMEOUT"), JOB_TIMEOUT_MS);
  });
  try {
    const resultado = await Promise.race([procesarJob(prisma, jobId), timeout]);
    if (resultado === "TIMEOUT") {
      console.error(`[worker] Timeout procesando ${jobId}.`);
      await marcarTimeout(jobId);
    } else {
      console.log(`[worker] Job ${jobId} → ${resultado}`);
    }
  } catch (e) {
    // procesarJob maneja los errores del alta; esto es algo inesperado (DB caída,
    // job borrado). Lo logueamos y seguimos: el loop no se cae por un job.
    console.error(`[worker] Error inesperado con ${jobId}:`, e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`[worker] Arrancando. Polling cada ${POLL_MS} ms, timeout por job ${JOB_TIMEOUT_MS} ms.`);
  await recuperarHuerfanos();

  while (!apagando) {
    let jobId: string | null = null;
    try {
      jobId = await reclamarSiguiente();
    } catch (e) {
      // DB inaccesible: no morimos, reintentamos al próximo tick.
      console.error("[worker] Error consultando la cola:", e instanceof Error ? e.message : e);
    }

    if (jobId) {
      await procesarConTimeout(jobId);
    } else if (!apagando) {
      await dormir(POLL_MS);
    }
  }

  console.log("[worker] Apagado prolijo. Chau.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[worker] Error fatal:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
