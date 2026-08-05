import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCategoriaSku, buildProductoSku } from "../src/lib/sku";

// Reclasifica los productos que quedaron en #REV (sin clasificar) en dos
// subcategorías: Tangible (#REV-TAN) e Intangible (#REV-INT). Al mover cada
// producto se le regenera secuencia + codigoSku con los helpers de src/lib/sku.
//
// La lista de INTANGIBLES vive en scripts/rev-intangibles.txt (uno por línea,
// admite comentarios "#"). Todo lo demás en #REV -> TANGIBLE.
//
//   npm run rev:reclasificar            -> DRY-RUN (no escribe; solo CSV + resumen)
//   npm run rev:reclasificar -- --apply -> aplica en una transacción
//
// Re-ejecutable: solo toca productos que cuelguen directo de #REV.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const APPLY = process.argv.includes("--apply");

function leerIntangibles(): Set<string> {
  const txt = readFileSync("scripts/rev-intangibles.txt", "utf8");
  const ids = txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/)[0]); // primer token; ignora el "# NOMBRE"
  return new Set(ids);
}

async function main() {
  const intangibles = leerIntangibles();

  const rev = await prisma.categoria.findUnique({ where: { codigoSku: "#REV" } });
  if (!rev) throw new Error("No existe la categoría #REV. ¿Corriste el sync de Teamplace?");

  // Subcategorías Tangible / Intangible (idempotente por codigoSku).
  const tanSku = buildCategoriaSku(rev.codigoSku, "TAN");
  const intSku = buildCategoriaSku(rev.codigoSku, "INT");
  const tan = await prisma.categoria.upsert({
    where: { codigoSku: tanSku },
    update: {},
    create: {
      parentId: rev.id, segmento: "TAN", codigoSku: tanSku, orden: 0,
      nombre: "Tangible",
      descripcion: "Bienes físicos inventariables que estaban sin clasificar.",
    },
  });
  const int = await prisma.categoria.upsert({
    where: { codigoSku: intSku },
    update: {},
    create: {
      parentId: rev.id, segmento: "INT", codigoSku: intSku, orden: 1,
      nombre: "Intangible",
      descripcion: "Servicios, ítems financieros/contables, conectividad, licencias, impuestos y tasas.",
    },
  });

  // Productos que cuelgan DIRECTO de #REV (no los ya movidos a TAN/INT).
  const productos = await prisma.producto.findMany({
    where: { categoriaId: rev.id },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, codigoSku: true, secuencia: true, teamplaceCodigo: true },
  });

  // Chequeo de integridad: ids del .txt que no están en #REV (typos / ya movidos).
  const idsEnRev = new Set(productos.map((p) => p.id));
  const noEncontrados = [...intangibles].filter((id) => !idsEnRev.has(id));

  // Continuar la numeración si ya había algo en TAN/INT (re-run).
  const maxTan = (await prisma.producto.aggregate({ where: { categoriaId: tan.id }, _max: { secuencia: true } }))._max.secuencia ?? 0;
  const maxInt = (await prisma.producto.aggregate({ where: { categoriaId: int.id }, _max: { secuencia: true } }))._max.secuencia ?? 0;

  let nTan = maxTan;
  let nInt = maxInt;
  const plan = productos.map((p) => {
    const esInt = intangibles.has(p.id);
    const cat = esInt ? int : tan;
    const secuencia = esInt ? ++nInt : ++nTan;
    return {
      id: p.id,
      nombre: p.nombre.trim(),
      teamplaceCodigo: p.teamplaceCodigo ?? "",
      tipo: esInt ? "INTANGIBLE" : "TANGIBLE",
      categoriaId: cat.id,
      secuencia,
      skuAnterior: p.codigoSku,
      skuNuevo: buildProductoSku(cat.codigoSku, secuencia),
    };
  });

  // Auditoría a CSV.
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [
    "id,teamplaceCodigo,nombre,tipo,skuAnterior,skuNuevo",
    ...plan.map((x) => [x.id, esc(x.teamplaceCodigo), esc(x.nombre), x.tipo, x.skuAnterior, x.skuNuevo].join(",")),
  ].join("\n");
  writeFileSync("scripts/rev-clasificacion.csv", csv);

  const nInts = plan.filter((x) => x.tipo === "INTANGIBLE").length;
  const nTans = plan.length - nInts;
  console.log("──────────────────────────────────────────────");
  console.log(`Modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN (no escribe)"}`);
  console.log(`Productos en #REV: ${plan.length}`);
  console.log(`  → TANGIBLE  (#REV-TAN): ${nTans}`);
  console.log(`  → INTANGIBLE(#REV-INT): ${nInts}`);
  console.log(`Auditoría: scripts/rev-clasificacion.csv`);
  if (noEncontrados.length) {
    console.log(`⚠️  ${noEncontrados.length} id(s) del .txt no están en #REV (typo o ya movidos):`);
    for (const id of noEncontrados) console.log(`     ${id}`);
  }
  console.log("──────────────────────────────────────────────");

  if (!APPLY) {
    console.log("DRY-RUN: nada se escribió en la DB. Revisá el CSV y corré con --apply.");
    return;
  }

  // Snapshot del estado ANTERIOR (para rollback exacto con rollback-rev.ts).
  const snapshot = productos.map((p) => ({
    id: p.id, categoriaId: rev.id, secuencia: p.secuencia, codigoSku: p.codigoSku,
  }));
  writeFileSync("scripts/rev-snapshot.json", JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot previo: scripts/rev-snapshot.json (${snapshot.length} filas)`);

  await prisma.$transaction(
    async (tx) => {
      for (const x of plan) {
        await tx.producto.update({
          where: { id: x.id },
          data: { categoriaId: x.categoriaId, secuencia: x.secuencia, codigoSku: x.skuNuevo },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  console.log(`✅ Aplicado: ${plan.length} productos reclasificados.`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
