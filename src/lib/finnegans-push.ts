import { prisma } from "@/lib/prisma";

// Encola el alta de un producto en Finnegans Go.
//
// La app ya NO lanza procesos: solo inserta un FinnegansPushJob en estado
// PENDIENTE. El microservicio worker (worker/index.ts, contenedor
// centralsm-worker) hace polling de la tabla, reclama el job y corre el bot
// de Playwright. La UI consulta el estado por polling vía getPushJob, igual
// que siempre: la tabla es el único punto de contacto entre app y worker.

/**
 * Crea un job PENDIENTE para el producto y devuelve su id para que la UI
 * haga polling. El worker lo tomará en su próximo tick (~4 s).
 */
export async function lanzarPushFinnegans(productoId: string): Promise<string> {
  // Un solo job vivo por producto: un doble click o un reintento apurado no
  // deben terminar en dos altas del mismo código en Finnegans.
  const activo = await prisma.finnegansPushJob.findFirst({
    where: { productoId, estado: { in: ["PENDIENTE", "EN_PROCESO"] } },
    select: { id: true },
  });
  if (activo) return activo.id;

  const previos = await prisma.finnegansPushJob.count({ where: { productoId } });

  const job = await prisma.finnegansPushJob.create({
    data: { productoId, estado: "PENDIENTE", intento: previos + 1 },
  });

  await prisma.producto.update({
    where: { id: productoId },
    data: { finnegansPushEstado: "PENDIENTE", finnegansPushError: null },
  });

  return job.id;
}

async function marcarError(jobId: string, error: string) {
  try {
    const job = await prisma.finnegansPushJob.update({
      where: { id: jobId },
      data: { estado: "ERROR", error, finishedAt: new Date() },
    });
    await prisma.producto.update({
      where: { id: job.productoId },
      data: { finnegansPushEstado: "ERROR", finnegansPushError: error },
    });
  } catch {
    // el job pudo haber sido borrado; nada que hacer
  }
}

/**
 * Red de seguridad de la UI: si el worker está caído (job PENDIENTE que nadie
 * toma) o murió sin poder escribir (EN_PROCESO eterno), pasado este tiempo lo
 * damos por fallido para que la UI no gire para siempre. Es más largo que el
 * timeout del propio worker porque un PENDIENTE puede estar legítimamente
 * encolado detrás de otros jobs.
 */
const TIMEOUT_MS = 10 * 60 * 1000;

/** Estado actual de un job (para el endpoint de polling). */
export async function getPushJob(jobId: string) {
  const job = await prisma.finnegansPushJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      estado: true,
      intento: true,
      error: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      producto: { select: { id: true, nombre: true, teamplaceCodigo: true } },
    },
  });
  if (!job) return null;

  const enCurso = job.estado === "PENDIENTE" || job.estado === "EN_PROCESO";
  // EN_PROCESO se mide desde que el worker lo reclamó, no desde que se encoló.
  const inicio = (job.estado === "EN_PROCESO" && job.startedAt) || job.createdAt;
  const vencido = Date.now() - inicio.getTime() > TIMEOUT_MS;
  if (!enCurso || !vencido) return job;

  const error =
    job.estado === "PENDIENTE"
      ? "El worker de Finnegans no tomó el trabajo. ¿Está corriendo el contenedor centralsm-worker?"
      : "El bot se quedó sin responder (timeout). Revisá los logs del worker y la captura en resultados/.";

  await marcarError(job.id, error);
  return { ...job, estado: "ERROR" as const, error };
}
