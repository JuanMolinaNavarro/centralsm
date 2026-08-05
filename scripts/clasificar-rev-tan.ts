import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCategoriaSku, buildProductoSku } from "../src/lib/sku";

// Clasificación MANUAL de los artículos de #REV-TAN que tienen stock.
// Crea las categorías nuevas que hacen falta y mueve cada producto a su
// familia definitiva, regenerando secuencia + codigoSku.
//
// El mapeo (codigo Teamplace -> SKU destino) vive en
// scripts/clasificacion-rev-tan.txt y se editó a mano.
//
//   npm run clasif:347              -> DRY-RUN (no escribe; CSV + resumen)
//   npm run clasif:347 -- --apply   -> aplica en una transacción
//   npm run clasif:347 -- --rollback-> restaura el snapshot previo
//
// Re-ejecutable: solo toca productos que sigan colgando de #REV-TAN.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");

const MAPEO = "scripts/clasificacion-rev-tan.txt";
const SNAPSHOT = "scripts/clasif-rev-tan-snapshot.json";
const AUDITORIA = "scripts/clasif-rev-tan.csv";

// ── Taxonomía nueva ────────────────────────────────────────────────────────
// Macros nuevas (con sus familias).
const MACROS_NUEVAS: {
  frag: string; nombre: string; descripcion: string;
  familias: { frag: string; nombre: string }[];
}[] = [
  {
    frag: "OFI",
    nombre: "Oficina y Administración",
    descripcion: "Papelería, mobiliario y equipamiento administrativo.",
    familias: [
      { frag: "PAP", nombre: "Papelería y librería" },
      { frag: "MOB", nombre: "Mobiliario" },
      { frag: "EQU", nombre: "Equipamiento de oficina" },
    ],
  },
  {
    frag: "CMP",
    nombre: "Componentes y Electrónica",
    descripcion: "Componentes discretos, conexionado eléctrico y soldadura.",
    familias: [
      { frag: "ELE", nombre: "Componentes electrónicos" },
      { frag: "CNX", nombre: "Conexionado y terminales" },
      { frag: "SOL", nombre: "Soldadura y estañado" },
    ],
  },
  {
    frag: "OBR",
    nombre: "Obra, Materiales e Infraestructura",
    descripcion: "Materiales de obra, estructuras, pinturas y mantenimiento edilicio.",
    familias: [
      { frag: "MET", nombre: "Materiales y estructuras" },
      { frag: "PIN", nombre: "Pinturas, químicos y accesorios" },
      { frag: "VAR", nombre: "Varios de obra y mantenimiento" },
    ],
  },
  {
    frag: "VEH",
    nombre: "Vehículos y Movilidad",
    descripcion: "Repuestos, accesorios y equipamiento de la flota.",
    familias: [{ frag: "REP", nombre: "Repuestos y accesorios" }],
  },
];

// Familias nuevas que cuelgan de macros YA existentes.
const FAMILIAS_NUEVAS: { macro: string; frag: string; nombre: string }[] = [
  { macro: "TV",  frag: "HFC",  nombre: "Nodos y óptica HFC" },
  { macro: "SEG", frag: "MOV",  nombre: "Videovigilancia móvil (vehicular / bodycam)" },
  { macro: "SEG", frag: "ACC",  nombre: "Control de acceso y seguridad física" },
  { macro: "SEG", frag: "VW",   nombre: "Monitores y videowall" },
  { macro: "RED", frag: "TEL",  nombre: "Telefonía y voz" },
  { macro: "RED", frag: "DSL",  nombre: "Acceso xDSL / DSLAM" },
  { macro: "ENE", frag: "CAB",  nombre: "Cables y conductores eléctricos" },
  { macro: "ENE", frag: "ILU",  nombre: "Iluminación" },
  { macro: "ENE", frag: "GEN",  nombre: "Grupos electrógenos" },
  { macro: "TI",  frag: "CAB",  nombre: "Cables y conectividad informática / AV" },
  { macro: "TI",  frag: "COMP", nombre: "Componentes y repuestos de PC" },
  { macro: "TI",  frag: "PER",  nombre: "Periféricos y audio" },
  { macro: "TI",  frag: "INS",  nombre: "Insumos de impresión" },
  { macro: "HER", frag: "SEG",  nombre: "Señalización, seguridad e higiene" },
  { macro: "REV", frag: "PLA",  nombre: "Placeholder de partida (sin descripción real)" },
];

type Fila = { codigo: string; sku: string; nombre: string };

function leerMapeo(): Fila[] {
  const txt = readFileSync(MAPEO, "utf8");
  const filas: Fila[] = [];
  for (const linea of txt.split(/\r?\n/)) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const partes = l.split("|").map((s) => s.trim());
    if (partes.length < 2 || !partes[0] || !partes[1]) {
      throw new Error(`Línea inválida en ${MAPEO}: "${linea}"`);
    }
    filas.push({ codigo: partes[0], sku: partes[1], nombre: partes[2] ?? "" });
  }
  return filas;
}

async function rollback() {
  if (!existsSync(SNAPSHOT)) throw new Error(`No existe ${SNAPSHOT}. Nada para revertir.`);
  const snap: { id: string; categoriaId: string; secuencia: number; codigoSku: string }[] =
    JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  await prisma.$transaction(
    async (tx) => {
      for (const s of snap) {
        await tx.producto.update({ where: { id: s.id }, data: { codigoSku: `TMP-${s.id}` } });
      }
      for (const s of snap) {
        await tx.producto.update({
          where: { id: s.id },
          data: { categoriaId: s.categoriaId, secuencia: s.secuencia, codigoSku: s.codigoSku },
        });
      }
    },
    { timeout: 180_000, maxWait: 20_000 },
  );
  console.log(`✅ Rollback aplicado: ${snap.length} productos restaurados a #REV-TAN.`);
}

async function main() {
  if (ROLLBACK) return rollback();

  const filas = leerMapeo();

  // Códigos duplicados en el mapeo = error de edición.
  const vistos = new Set<string>();
  const dup = filas.filter((f) => (vistos.has(f.codigo) ? true : (vistos.add(f.codigo), false)));
  if (dup.length) {
    throw new Error(`Códigos duplicados en el mapeo: ${dup.map((d) => d.codigo).join(", ")}`);
  }

  // ── 1) Categorías nuevas. En DRY-RUN solo se detectan; se crean con --apply.
  const creadas: string[] = [];
  const catIdBySku = new Map<string, string>();

  for (const [i, macro] of MACROS_NUEVAS.entries()) {
    const macroSku = buildCategoriaSku(null, macro.frag);
    let m = await prisma.categoria.findUnique({ where: { codigoSku: macroSku } });
    if (!m) {
      creadas.push(macroSku);
      if (APPLY) {
        m = await prisma.categoria.create({
          data: {
            segmento: macro.frag, codigoSku: macroSku, nombre: macro.nombre,
            descripcion: macro.descripcion, orden: 10 + i,
          },
        });
      }
    }
    if (m) catIdBySku.set(macroSku, m.id);
    for (const [j, fam] of macro.familias.entries()) {
      const famSku = buildCategoriaSku(macroSku, fam.frag);
      let f = await prisma.categoria.findUnique({ where: { codigoSku: famSku } });
      if (!f) {
        creadas.push(famSku);
        if (APPLY) {
          if (!m) throw new Error(`Falta la macro ${macroSku} para crear ${famSku}.`);
          f = await prisma.categoria.create({
            data: { parentId: m.id, segmento: fam.frag, codigoSku: famSku, nombre: fam.nombre, orden: j },
          });
        }
      }
      if (f) catIdBySku.set(famSku, f.id);
    }
  }

  for (const [i, fam] of FAMILIAS_NUEVAS.entries()) {
    const macroSku = buildCategoriaSku(null, fam.macro);
    const macro = await prisma.categoria.findUnique({ where: { codigoSku: macroSku } });
    if (!macro) throw new Error(`No existe la macro ${macroSku} (¿corriste el sync de Teamplace?).`);
    const famSku = buildCategoriaSku(macroSku, fam.frag);
    let f = await prisma.categoria.findUnique({ where: { codigoSku: famSku } });
    if (!f) {
      creadas.push(famSku);
      if (APPLY) {
        f = await prisma.categoria.create({
          data: { parentId: macro.id, segmento: fam.frag, codigoSku: famSku, nombre: fam.nombre, orden: 50 + i },
        });
      }
    }
    if (f) catIdBySku.set(famSku, f.id);
  }

  // Resolver las categorías destino que YA existían.
  const skusDestino = [...new Set(filas.map((f) => f.sku))];
  for (const sku of skusDestino) {
    if (catIdBySku.has(sku)) continue;
    const c = await prisma.categoria.findUnique({ where: { codigoSku: sku } });
    if (c) { catIdBySku.set(sku, c.id); continue; }
    // Solo puede faltar si es nueva y estamos en DRY-RUN (todavía no se creó).
    if (APPLY) throw new Error(`La categoría destino ${sku} no existe y no está en la taxonomía nueva.`);
  }

  // ── 2) Productos que siguen en #REV-TAN ─────────────────────────────────
  const revTan = await prisma.categoria.findUnique({ where: { codigoSku: "#REV-TAN" } });
  if (!revTan) throw new Error("No existe #REV-TAN. ¿Corriste npm run rev:reclasificar?");

  const enRevTan = await prisma.producto.findMany({
    where: { categoriaId: revTan.id },
    select: { id: true, nombre: true, codigoSku: true, secuencia: true, teamplaceCodigo: true, cantidadStock: true },
  });
  // Índice por código TRIMEADO (hay códigos con espacios de más en el ERP).
  const porCodigo = new Map<string, (typeof enRevTan)[number]>();
  for (const p of enRevTan) {
    const k = (p.teamplaceCodigo ?? "").trim();
    if (k) porCodigo.set(k, p);
  }

  // ── 3) Armar el plan ────────────────────────────────────────────────────
  // Correlativo por SKU destino (no por id) para que el DRY-RUN también sirva
  // cuando la categoría todavía no existe.
  const seqPorCatId = new Map<string, number>();
  for (const g of await prisma.producto.groupBy({ by: ["categoriaId"], _max: { secuencia: true } })) {
    seqPorCatId.set(g.categoriaId, g._max.secuencia ?? 0);
  }
  const maxSeq = new Map<string, number>();
  for (const sku of skusDestino) {
    const id = catIdBySku.get(sku);
    maxSeq.set(sku, id ? seqPorCatId.get(id) ?? 0 : 0);
  }

  const plan: {
    id: string; codigo: string; nombre: string; destinoSku: string;
    categoriaId: string; secuencia: number; skuAnterior: string; skuNuevo: string;
    secuenciaAnterior: number;
  }[] = [];
  const noEncontrados: Fila[] = [];

  for (const f of filas) {
    const p = porCodigo.get(f.codigo);
    if (!p) { noEncontrados.push(f); continue; }
    const categoriaId = catIdBySku.get(f.sku) ?? "";
    const secuencia = (maxSeq.get(f.sku) ?? 0) + 1;
    maxSeq.set(f.sku, secuencia);
    plan.push({
      id: p.id, codigo: f.codigo, nombre: p.nombre.trim(), destinoSku: f.sku,
      categoriaId, secuencia, skuAnterior: p.codigoSku,
      skuNuevo: buildProductoSku(f.sku, secuencia),
      secuenciaAnterior: p.secuencia,
    });
  }

  // Productos CON STOCK que quedaron fuera del mapeo (cobertura incompleta).
  const mapeados = new Set(plan.map((x) => x.id));
  const sinMapear = enRevTan.filter(
    (p) => !mapeados.has(p.id) && Number(p.cantidadStock.toString()) > 0,
  );

  // ── 4) Auditoría ────────────────────────────────────────────────────────
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  writeFileSync(
    AUDITORIA,
    [
      "teamplaceCodigo,nombre,destino,skuAnterior,skuNuevo",
      ...plan.map((x) => [esc(x.codigo), esc(x.nombre), x.destinoSku, x.skuAnterior, x.skuNuevo].join(",")),
    ].join("\n"),
  );

  const porDestino = new Map<string, number>();
  for (const x of plan) porDestino.set(x.destinoSku, (porDestino.get(x.destinoSku) ?? 0) + 1);

  console.log("──────────────────────────────────────────────");
  console.log(`Modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN (no escribe)"}`);
  console.log(`Categorías nuevas ${APPLY ? "creadas" : "a crear"}: ${creadas.length}`);
  for (const c of creadas) console.log(`     + ${c}`);
  console.log(`Productos a mover: ${plan.length} (de ${filas.length} en el mapeo)`);
  console.log("Destinos:");
  for (const [sku, n] of [...porDestino].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${sku.padEnd(12)} ${n}`);
  }
  if (noEncontrados.length) {
    console.log(`⚠️  ${noEncontrados.length} código(s) del mapeo no están en #REV-TAN (typo o ya movidos):`);
    for (const f of noEncontrados) console.log(`     ${f.codigo}  ${f.nombre}`);
  }
  if (sinMapear.length) {
    console.log(`⚠️  ${sinMapear.length} producto(s) CON STOCK siguen en #REV-TAN sin mapear:`);
    for (const p of sinMapear) console.log(`     ${p.teamplaceCodigo}  ${p.nombre}`);
  }
  console.log(`Auditoría: ${AUDITORIA}`);
  console.log("──────────────────────────────────────────────");

  if (!APPLY) {
    console.log("DRY-RUN: nada se escribió en la DB. Revisá el CSV y corré con --apply.");
    return;
  }

  // Snapshot para rollback exacto.
  writeFileSync(
    SNAPSHOT,
    JSON.stringify(
      plan.map((x) => ({
        id: x.id, categoriaId: revTan.id,
        secuencia: x.secuenciaAnterior, codigoSku: x.skuAnterior,
      })),
      null,
      2,
    ),
  );

  await prisma.$transaction(
    async (tx) => {
      // Dos pasadas: primero a un SKU temporal para no chocar con el índice
      // único de codigoSku si algún destino reutiliza un correlativo.
      for (const x of plan) {
        await tx.producto.update({ where: { id: x.id }, data: { codigoSku: `TMP-${x.id}` } });
      }
      for (const x of plan) {
        await tx.producto.update({
          where: { id: x.id },
          data: { categoriaId: x.categoriaId, secuencia: x.secuencia, codigoSku: x.skuNuevo },
        });
      }
    },
    { timeout: 180_000, maxWait: 20_000 },
  );
  console.log(`✅ Aplicado: ${plan.length} productos clasificados. Snapshot: ${SNAPSHOT}`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
