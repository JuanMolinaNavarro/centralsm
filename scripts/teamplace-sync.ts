import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncProductos } from "../src/lib/teamplace-jobs";

// Sync del maestro de productos (GRATIS). Espejo Teamplace -> CentralSM.
//   npm run teamplace:sync            -> upsert incremental
//   npm run teamplace:sync -- --fresh -> borra el catálogo y recarga de cero
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const FRESH = process.argv.includes("--fresh");

async function main() {
  if (FRESH) console.log("🗑️  --fresh: recargando el catálogo de cero");
  const r = await syncProductos(prisma, { fresh: FRESH });
  console.log("✅ Sync completo:", r);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
