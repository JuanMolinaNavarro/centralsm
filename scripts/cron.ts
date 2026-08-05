import "dotenv/config";
import cron from "node-cron";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { runDailySync } from "../src/lib/teamplace-jobs";

// Scheduler: corre la sincronización diaria todos los días a las 2 AM (hora
// de Argentina). Es un proceso de larga duración (servicio "cron" en Docker).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TZ = "America/Argentina/Buenos_Aires";
const SCHEDULE = process.env.CRON_SCHEDULE || "0 2 * * *"; // 02:00 todos los días

if (!cron.validate(SCHEDULE)) {
  console.error(`Cron inválido: "${SCHEDULE}"`);
  process.exit(1);
}

console.log(`⏰ Cron activo: "${SCHEDULE}" (${TZ}). Esperando la próxima corrida…`);

cron.schedule(
  SCHEDULE,
  async () => {
    const t0 = new Date().toISOString();
    console.log(`▶️ [${t0}] Iniciando corrida diaria…`);
    try {
      const run = await runDailySync(prisma, "CRON");
      console.log(
        run.ok ? "✅ Corrida OK" : "❌ Corrida con error",
        { nuevos: run.productosNuevos, conCambio: run.productosConCambio, error: run.error },
      );
    } catch (e) {
      console.error("❌ Fallo inesperado en la corrida:", e);
    }
  },
  { timezone: TZ },
);

// Mantener el proceso vivo y cerrar prolijo.
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
