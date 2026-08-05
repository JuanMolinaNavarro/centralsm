import "dotenv/config";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Regenera scripts/rev-intangibles.txt tras una pérdida de base: los IDs viejos
// del txt ya no existen, pero scripts/rev-clasificacion.csv conserva el mapeo
// teamplaceCodigo -> TANGIBLE/INTANGIBLE de la clasificación original.
//
//   npx tsx scripts/regen-rev-intangibles.ts
//
// Deja el txt anterior en scripts/rev-intangibles.txt.bak y reporta huérfanos.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const csv = readFileSync("scripts/rev-clasificacion.csv", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const header = parseCsvLine(csv[0]);
  const iCodigo = header.indexOf("teamplaceCodigo");
  const iTipo = header.indexOf("tipo");
  const iNombre = header.indexOf("nombre");
  if (iCodigo < 0 || iTipo < 0) throw new Error("CSV sin columnas esperadas");

  const intangibles = new Map<string, string>(); // teamplaceCodigo -> nombre
  for (const line of csv.slice(1)) {
    const f = parseCsvLine(line);
    if (f[iTipo] === "INTANGIBLE") intangibles.set(f[iCodigo], f[iNombre] ?? "");
  }

  const rev = await prisma.categoria.findUnique({ where: { codigoSku: "#REV" } });
  if (!rev) throw new Error("No existe #REV. ¿Corriste el sync?");
  const productos = await prisma.producto.findMany({
    where: { categoriaId: rev.id },
    select: { id: true, nombre: true, teamplaceCodigo: true },
  });
  const byCodigo = new Map(productos.map((p) => [p.teamplaceCodigo ?? "", p]));

  const lineas: string[] = [
    "# REGENERADO desde rev-clasificacion.csv (recuperación post-pérdida de DB).",
    "# IDs (Producto.id) de #REV clasificados como INTANGIBLE. El resto de #REV -> TANGIBLE.",
    "# Formato: <id>   # NOMBRE",
  ];
  const sinMatch: string[] = [];
  for (const [codigo, nombre] of intangibles) {
    const p = byCodigo.get(codigo);
    if (p) lineas.push(`${p.id}   # ${p.nombre.trim()}`);
    else sinMatch.push(`${codigo} (${nombre})`);
  }

  copyFileSync("scripts/rev-intangibles.txt", "scripts/rev-intangibles.txt.bak");
  writeFileSync("scripts/rev-intangibles.txt", lineas.join("\n") + "\n", "utf8");

  console.log(`Intangibles en CSV: ${intangibles.size}`);
  console.log(`Matcheados en #REV actual: ${intangibles.size - sinMatch.length}`);
  if (sinMatch.length) {
    console.log(`Sin match (ya no están en #REV o no vinieron del sync): ${sinMatch.length}`);
    for (const s of sinMatch) console.log("  -", s);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
