// Importa el kardex de Finnegans ("Detalle de Ingresos y Egresos por Depósito",
// viewID=136, exportado a xlsx y convertido a JSONL) hacia MovimientoArticulo.
//
// Uso:
//   npx tsx scripts/importar-kardex.ts scripts/kardex-24m.jsonl [--apply]
//
// Sin --apply corre en modo simulación (muestra el resumen y no escribe).
// Con --apply BORRA los movimientos con fuente=KARDEX y recarga todo, así el
// import es idempotente y se puede repetir con un export más nuevo.
//
// Reglas de clasificación (decididas el 2026-08-07 sobre el export real):
// - REMVTA/REMVTATUC a ABONADOS*            → CONSUMO (instalaciones)
// - REMVTA/REMVTATUC a TECNICA/CONTRATISTA/CUADRILLA → CONSUMO (operativo)
// - REMVTA/REMVTATUC a otras organizaciones → TRANSFERENCIA (inter-empresa)
// - MIS                                     → TRANSFERENCIA
// - REC / RECIMPO / PARTPROD                → RECEPCION_COMPRA
// - DEVVTA / DVAF                           → DEVOLUCION
// - AJSTOCK / AJSTOCKUSA / AJSTOCNSERIE     → AJUSTE
// - CONSPROD                                → CONSUMO
// - DEVCPRA                                 → DEVOLUCION_COMPRA

import "dotenv/config";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { prisma } from "../src/lib/prisma";
import type { TipoMovimiento } from "../src/generated/prisma/enums";

type Fila = {
  fecha: string;
  codigo: string;
  documento: string;
  docNombre: string | null;
  organizacion: string | null;
  deposito: string | null;
  empresa: string | null;
  cantidad: number;
};

function clasificar(f: Fila): TipoMovimiento | null {
  const doc = f.documento.split(" ")[0].toUpperCase();
  // Cubre REMVTA, REMVTATUC y las variantes por empresa (REMVTA-CCC, REMVTA0019…).
  if (doc.startsWith("REMVTA")) {
    const org = (f.organizacion ?? "").toUpperCase();
    if (org.includes("ABONADO")) return "CONSUMO";
    if (org.includes("TECNICA") || org.includes("TÉCNICA") || org.includes("CONTRATISTA") || org.includes("CUADRILLA"))
      return "CONSUMO";
    return "TRANSFERENCIA";
  }
  if (doc === "MIS") return "TRANSFERENCIA";
  if (doc === "REC" || doc === "RECIMPO" || doc === "PARTPROD") return "RECEPCION_COMPRA";
  if (doc === "DEVVTA" || doc === "DVAF") return "DEVOLUCION";
  if (doc.startsWith("AJSTOC")) return "AJUSTE";
  if (doc === "CONSPROD") return "CONSUMO";
  if (doc === "DEVCPRA") return "DEVOLUCION_COMPRA";
  return null; // tipo desconocido: se reporta y se saltea
}

async function main() {
  const [ruta, flag] = process.argv.slice(2);
  if (!ruta) {
    console.error("Uso: npx tsx scripts/importar-kardex.ts <archivo.jsonl> [--apply]");
    process.exit(1);
  }
  const aplicar = flag === "--apply";

  // Mapa código Finnegans → producto local.
  const productos = await prisma.producto.findMany({
    where: { teamplaceCodigo: { not: null } },
    select: { id: true, teamplaceCodigo: true },
  });
  const porCodigo = new Map(productos.map((p) => [p.teamplaceCodigo!.trim(), p.id]));
  console.log(`Productos con código Finnegans en la DB: ${porCodigo.size}`);

  const filas: {
    productoId: string;
    fecha: Date;
    tipo: TipoMovimiento;
    demanda: "RECURRENTE" | "NA";
    cantidad: number;
    destino: string | null;
    deposito: string | null;
    empresa: string | null;
    documento: string;
  }[] = [];

  const sinProducto = new Map<string, number>();
  const sinTipo = new Map<string, number>();
  const porTipo = new Map<string, number>();

  const rl = createInterface({ input: createReadStream(ruta, "utf-8"), crlfDelay: Infinity });
  for await (const linea of rl) {
    if (!linea.trim()) continue;
    const f: Fila = JSON.parse(linea);
    const productoId = porCodigo.get(f.codigo);
    if (!productoId) {
      sinProducto.set(f.codigo, (sinProducto.get(f.codigo) ?? 0) + 1);
      continue;
    }
    const tipo = clasificar(f);
    if (!tipo) {
      sinTipo.set(f.documento.split(" ")[0], (sinTipo.get(f.documento.split(" ")[0]) ?? 0) + 1);
      continue;
    }
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
    filas.push({
      productoId,
      fecha: new Date(f.fecha + "T00:00:00Z"),
      tipo,
      demanda: tipo === "CONSUMO" ? "RECURRENTE" : "NA",
      cantidad: Math.abs(f.cantidad),
      // Para remitos el destino informativo es la organización; para el resto,
      // el depósito donde impactó.
      destino: f.organizacion ?? f.deposito,
      deposito: f.deposito,
      empresa: f.empresa,
      documento: f.documento,
    });
  }

  console.log(`\nFilas a importar: ${filas.length}`);
  console.log("Por tipo:", Object.fromEntries([...porTipo.entries()].sort((a, b) => b[1] - a[1])));
  const perdidas = [...sinProducto.values()].reduce((a, b) => a + b, 0);
  console.log(`Sin producto en la DB: ${perdidas} filas de ${sinProducto.size} códigos (se saltean)`);
  if (sinTipo.size) console.log("Documentos sin regla:", Object.fromEntries(sinTipo));

  if (!aplicar) {
    console.log("\nSimulación (sin --apply): no se escribió nada.");
    return;
  }

  const borrados = await prisma.movimientoArticulo.deleteMany({ where: { fuente: "KARDEX" } });
  console.log(`\nBorrados de imports anteriores: ${borrados.count}`);

  const LOTE = 1000;
  for (let i = 0; i < filas.length; i += LOTE) {
    await prisma.movimientoArticulo.createMany({
      data: filas.slice(i, i + LOTE).map((f) => ({
        productoId: f.productoId,
        fecha: f.fecha,
        tipo: f.tipo,
        demanda: f.demanda,
        solicitado: f.cantidad,
        entregado: f.cantidad,
        destino: f.destino,
        deposito: f.deposito,
        empresa: f.empresa,
        documento: f.documento,
        fuente: "KARDEX",
      })),
    });
    if ((i / LOTE) % 20 === 0) console.log(`  ${i + Math.min(LOTE, filas.length - i)} / ${filas.length}`);
  }
  console.log(`Importados: ${filas.length} movimientos (fuente=KARDEX).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
