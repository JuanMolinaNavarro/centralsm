import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { runDailySync } from "../src/lib/teamplace-jobs";

// Corrida diaria completa: productos (gratis) + stock (1 reporte PAGO) +
// cálculo del delta día a día + marca de productos nuevos + bitácora (SyncRun).
//   npm run sync:daily
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const tipo = process.argv.includes("--cron") ? "CRON" : "MANUAL";
  console.log(`▶️ Corrida diaria (${tipo})…  [incluye 1 reporte de stock PAGO]`);
  const run = await runDailySync(prisma, tipo);
  if (run.ok) {
    console.log("✅ OK:", {
      nuevos: run.productosNuevos,
      conCambio: run.productosConCambio,
      alta: run.unidadesAlta.toString(),
      baja: run.unidadesBaja.toString(),
      stock: run.stockRegistros,
      depositos: run.depositos,
      ms: run.duracionMs,
    });
  } else {
    console.error("❌ ERROR:", run.error);
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
