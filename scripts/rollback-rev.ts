import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Revierte reclasificar-rev.ts: restaura categoriaId/secuencia/codigoSku de cada
// producto desde scripts/rev-snapshot.json (deja todo de nuevo colgando de #REV)
// y borra las subcategorías vacías #REV-TAN / #REV-INT.
//
//   npm run rev:rollback

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const snap: { id: string; categoriaId: string; secuencia: number; codigoSku: string }[] =
    JSON.parse(readFileSync("scripts/rev-snapshot.json", "utf8"));

  await prisma.$transaction(
    async (tx) => {
      for (const s of snap) {
        await tx.producto.update({
          where: { id: s.id },
          data: { categoriaId: s.categoriaId, secuencia: s.secuencia, codigoSku: s.codigoSku },
        });
      }
      // Borrar TAN/INT si ya no tienen productos.
      for (const sku of ["#REV-TAN", "#REV-INT"]) {
        const cat = await tx.categoria.findUnique({
          where: { codigoSku: sku },
          include: { _count: { select: { productos: true, children: true } } },
        });
        if (cat && cat._count.productos === 0 && cat._count.children === 0) {
          await tx.categoria.delete({ where: { id: cat.id } });
        }
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  console.log(`✅ Rollback: ${snap.length} productos restaurados a #REV; subcategorías vacías eliminadas.`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
