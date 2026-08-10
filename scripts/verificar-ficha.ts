// Chequeo rápido post-import: imprime el derivado de la ficha para unos
// artículos conocidos. Uso: npx tsx scripts/verificar-ficha.ts [codigo...]
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getFichaData } from "../src/lib/ficha-data";

async function main() {
  const codigos = process.argv.slice(2).length ? process.argv.slice(2) : ["N040132", "N020524", "I040132"];
  for (const codigo of codigos) {
    const p = await prisma.producto.findUnique({ where: { teamplaceCodigo: codigo }, select: { id: true } });
    if (!p) {
      console.log(`${codigo}: no está en la DB`);
      continue;
    }
    const d = await getFichaData(p.id);
    if (!d) continue;
    const c = d.calculo;
    console.log(`\n${codigo} · ${d.producto.nombre} (${d.producto.unidadBase})`);
    console.log(`  movimientos ventana: ${d.movimientos.length} · consumo total: ${c.total.toLocaleString("es-AR")}`);
    console.log(`  k=${c.mesesActivos}/24 · ADI=${c.adi?.toFixed(2)} · CV²=${c.cv2.toFixed(2)} → ${c.patron}`);
    console.log(`  diario=${c.consumoDiario.toFixed(1)} · cobertura=${c.coberturaDias?.toFixed(0) ?? "—"} días (stock ${d.producto.stock.toLocaleString("es-AR")})`);
    console.log(`  serie: ${d.serie.map((v) => Math.round(v)).join(" ")}`);
    console.log(`  ficha: http://localhost:3100/catalogo/articulo/${p.id}/ficha`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
