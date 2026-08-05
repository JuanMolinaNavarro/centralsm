import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { runDailySync } from "../src/lib/teamplace-jobs";

// Pull manual de stock. Es un REPORTE => 1 interacción PAGA.
//   npm run teamplace:stock-pull
//
// Corre la MISMA rutina que el cron (runDailySync): antes llamaba a
// pullStockSnapshot directo y descartaba los deltas, con lo cual un pull
// manual entre crons hacía desaparecer movimientos del histórico para
// siempre. Ahora todo pull deja HistorialStock + SnapshotStock + SyncRun.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("🌐 Corrida manual de sync + stock…  [⚠️ 1 interacción PAGA]");
  const run = await runDailySync(prisma, "MANUAL");
  if (!run.ok) throw new Error(run.error ?? "SyncRun falló");
  console.log(`✅ OK: ${run.stockRegistros} registros en ${run.depositos} depósitos; ${run.productosConCambio} productos con cambios.`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
