import type { PrismaClient } from "../generated/prisma/client";
import { listarProductos, getStockPorDeposito } from "./teamplace";
import { TAXONOMIA, clasificar } from "./taxonomia";
import { buildCategoriaSku, buildProductoSku } from "./sku";

// ---------------------------------------------------------------------------
// Jobs reutilizables de Teamplace: sync de productos (gratis), pull de stock
// (pago) y la corrida diaria que combina ambos + calcula el delta y marca
// productos nuevos. Los usan los scripts y el cron.
// ---------------------------------------------------------------------------

/**
 * Asegura el árbol de categorías de la taxonomía sin pisar la curaduría
 * manual: las que existen se usan tal cual (no se les toca nombre/descripcion)
 * y las que faltan se crean solo si no tienen lápida en CategoriaEliminada (el
 * usuario las borró a propósito). #REV se asegura siempre: es el fallback del
 * clasificador. Devuelve el mapa codigoSku → id de las categorías vigentes.
 */
export async function asegurarTaxonomia(prisma: PrismaClient): Promise<Map<string, string>> {
  const tumbas = new Set(
    (await prisma.categoriaEliminada.findMany({ select: { codigoSku: true } })).map(
      (t) => t.codigoSku,
    ),
  );
  const revSku = buildCategoriaSku(null, "REV");
  const catIdBySku = new Map<string, string>();
  for (const [i, macro] of TAXONOMIA.entries()) {
    const macroSku = buildCategoriaSku(null, macro.frag);
    let m = await prisma.categoria.findUnique({ where: { codigoSku: macroSku } });
    if (!m) {
      // Macro eliminada: se saltea con sus familias (no tendrían parent).
      if (tumbas.has(macroSku) && macroSku !== revSku) continue;
      m = await prisma.categoria.create({
        data: { segmento: macro.frag, codigoSku: macroSku, nombre: macro.nombre, descripcion: macro.descripcion ?? null, orden: i },
      });
    }
    catIdBySku.set(macroSku, m.id);
    for (const [j, fam] of macro.familias.entries()) {
      const famSku = buildCategoriaSku(macroSku, fam.frag);
      let f = await prisma.categoria.findUnique({ where: { codigoSku: famSku } });
      if (!f) {
        if (tumbas.has(famSku)) continue;
        f = await prisma.categoria.create({
          data: { parentId: m.id, segmento: fam.frag, codigoSku: famSku, nombre: fam.nombre, orden: j },
        });
      }
      catIdBySku.set(famSku, f.id);
    }
  }
  return catIdBySku;
}

/** Sincroniza el maestro de productos (GRATIS). Devuelve códigos nuevos. */
export async function syncProductos(
  prisma: PrismaClient,
  opts: { fresh?: boolean } = {},
): Promise<{ creados: number; actualizados: number; nuevosCodigos: string[] }> {
  if (opts.fresh) await prisma.categoria.deleteMany({});

  // 1) Asegurar el árbol de categorías (respetando las eliminadas a propósito).
  const revSku = buildCategoriaSku(null, "REV");
  const catIdBySku = await asegurarTaxonomia(prisma);

  // 2) Traer productos activos (sin duplicar código).
  const raw = await listarProductos();
  const vistos = new Set<string>();
  const productos = raw.filter((p) => {
    if (!p.activo || !p.codigo || vistos.has(p.codigo)) return false;
    vistos.add(p.codigo);
    return true;
  });

  // 3) Estado local para upsert por teamplaceCodigo + secuencias.
  const existentes = await prisma.producto.findMany({
    where: { teamplaceCodigo: { not: null } },
    select: { id: true, teamplaceCodigo: true },
  });
  const idByCodigo = new Map(existentes.map((e) => [e.teamplaceCodigo as string, e.id]));

  const seq = new Map<string, number>();
  for (const g of await prisma.producto.groupBy({ by: ["categoriaId"], _max: { secuencia: true } })) {
    seq.set(g.categoriaId, g._max.secuencia ?? 0);
  }
  const skuByCatId = new Map([...catIdBySku].map(([sku, id]) => [id, sku]));

  const nuevos: {
    categoriaId: string; secuencia: number; codigoSku: string; nombre: string;
    descripcion: string | null; estado: "ACTIVO" | "INACTIVO"; teamplaceCodigo: string; teamplaceSyncAt: Date;
  }[] = [];
  const updates: { id: string; nombre: string; descripcion: string | null }[] = [];
  const nuevosCodigos: string[] = [];

  for (const p of productos) {
    const cls = clasificar(p.nombre, p.codigo);
    if (cls.tipo === "NIN" || cls.tipo === "TEST") continue;

    const catSku =
      cls.tipo === "REV"
        ? revSku
        : buildCategoriaSku(buildCategoriaSku(null, cls.macroFrag!), cls.famFrag!);
    // Si la categoría destino fue eliminada por el usuario, el producto cae en
    // #REV para clasificar a mano.
    const categoriaId = catIdBySku.get(catSku) ?? catIdBySku.get(revSku)!;

    const yaId = idByCodigo.get(p.codigo);
    if (yaId) {
      updates.push({ id: yaId, nombre: p.nombre, descripcion: p.descripcion || null });
    } else {
      nuevosCodigos.push(p.codigo);
      const n = (seq.get(categoriaId) ?? 0) + 1;
      seq.set(categoriaId, n);
      nuevos.push({
        categoriaId,
        secuencia: n,
        codigoSku: buildProductoSku(skuByCatId.get(categoriaId)!, n),
        nombre: p.nombre,
        descripcion: p.descripcion || null,
        estado: p.activo ? "ACTIVO" : "INACTIVO",
        teamplaceCodigo: p.codigo,
        teamplaceSyncAt: new Date(),
      });
    }
  }

  for (let i = 0; i < nuevos.length; i += 500) {
    await prisma.producto.createMany({ data: nuevos.slice(i, i + 500) });
  }
  for (const u of updates) {
    await prisma.producto.update({ where: { id: u.id }, data: { nombre: u.nombre, descripcion: u.descripcion, teamplaceSyncAt: new Date() } });
  }

  return { creados: nuevos.length, actualizados: updates.length, nuevosCodigos };
}

export type StockDeltaRow = {
  productoId: string;
  depositoId: string;
  antes: number;
  ahora: number;
  delta: number;
};

export type SnapshotRow = {
  productoId: string;
  depositoId: string;
  cantidad: number;
  puntoReposicion: number | null;
};

/** Trae el reporte de stock (⚠️ 1 interacción PAGA), calcula los deltas por
 * (producto, depósito) contra el snapshot anterior, y guarda el nuevo snapshot.
 * Con `guardarAnterior`, congela Producto.cantidadStockAnterior dentro de la
 * misma transacción (así un fallo a mitad de camino no lo deja pisado). */
export async function pullStockSnapshot(
  prisma: PrismaClient,
  opts: { guardarAnterior?: boolean } = {},
): Promise<{
  stockRegistros: number;
  depositos: number;
  deltas: StockDeltaRow[];
  snapshot: SnapshotRow[];
  filasDescartadas: number;
}> {
  const moneda = process.env.TEAMPLACE_MONEDA || "PES";
  const rows = await getStockPorDeposito({ MonedaID: moneda, soloStockNoCero: true });

  const prods = await prisma.producto.findMany({
    where: { teamplaceCodigo: { not: null } },
    select: { id: true, teamplaceCodigo: true },
  });
  const prodByCodigo = new Map(prods.map((p) => [p.teamplaceCodigo as string, p.id]));

  const depots = new Map<string, string>();
  for (const r of rows) {
    const id = r["DEPOSITOID"];
    if (id == null) continue;
    depots.set(String(id), String(r["DEPOSITO"] ?? `Depósito ${id}`));
  }
  const depIdByKey = new Map<string, string>();
  for (const [key, nombre] of depots) {
    const d = await prisma.deposito.upsert({
      where: { codigo: key },
      update: { nombre },
      create: { codigo: key, nombre },
    });
    depIdByKey.set(key, d.id);
  }

  const agg = new Map<string, { productoId: string; depositoId: string; cantidad: number; pr: number | null }>();
  let filasDescartadas = 0;
  for (const r of rows) {
    const prodId = prodByCodigo.get(String(r["PRODUCTOCODIGO"]));
    const depId = depIdByKey.get(String(r["DEPOSITOID"]));
    if (!prodId || !depId) {
      // Stock de productos fuera del catálogo local (NIN/TEST o aún no
      // sincronizados). Se cuenta para que no desaparezca en silencio.
      filasDescartadas++;
      continue;
    }
    const k = `${prodId}|${depId}`;
    const cant = Number(r["CANTIDAD1"]) || 0;
    const pr = r["PUNTOREPOSICION"] != null ? Number(r["PUNTOREPOSICION"]) : null;
    const cur = agg.get(k);
    if (cur) cur.cantidad += cant;
    else agg.set(k, { productoId: prodId, depositoId: depId, cantidad: cant, pr });
  }

  // Deltas por (producto, depósito) vs el snapshot anterior (antes de pisarlo).
  const prev = await prisma.stockDeposito.findMany({
    select: { productoId: true, depositoId: true, cantidad: true },
  });
  const comb = new Map<string, { productoId: string; depositoId: string; old: number; nue: number }>();
  for (const p of prev) {
    comb.set(`${p.productoId}|${p.depositoId}`, {
      productoId: p.productoId,
      depositoId: p.depositoId,
      old: Number(p.cantidad.toString()),
      nue: 0,
    });
  }
  for (const [k, v] of agg) {
    const e = comb.get(k);
    if (e) e.nue = v.cantidad;
    else comb.set(k, { productoId: v.productoId, depositoId: v.depositoId, old: 0, nue: v.cantidad });
  }
  const deltas: StockDeltaRow[] = [];
  for (const c of comb.values()) {
    const d = c.nue - c.old;
    if (d !== 0) deltas.push({ productoId: c.productoId, depositoId: c.depositoId, antes: c.old, ahora: c.nue, delta: d });
  }

  const now = new Date();
  const data = [...agg.values()].map((v) => ({
    productoId: v.productoId,
    depositoId: v.depositoId,
    cantidad: v.cantidad,
    cantidadTeamplace: v.cantidad,
    puntoReposicion: v.pr,
    snapshotAt: now,
  }));

  if (filasDescartadas > 0) {
    console.warn(`[stock] ${filasDescartadas} filas del reporte sin producto/depósito local (NIN/TEST u otros); no se registran.`);
  }

  // Todo o nada: si el proceso muere a mitad de camino, el snapshot anterior
  // queda intacto (reponerlo costaría otra interacción PAGA de Teamplace).
  await prisma.$transaction(
    async (tx) => {
      if (opts.guardarAnterior) {
        await tx.$executeRaw`UPDATE "Producto" SET "cantidadStockAnterior" = "cantidadStock" WHERE "teamplaceCodigo" IS NOT NULL`;
      }

      await tx.stockDeposito.deleteMany({});
      for (let i = 0; i < data.length; i += 500) {
        await tx.stockDeposito.createMany({ data: data.slice(i, i + 500) });
      }

      // Denormalizar total en Producto.cantidadStock.
      await tx.$executeRaw`UPDATE "Producto" SET "cantidadStock" = 0 WHERE "teamplaceCodigo" IS NOT NULL`;
      await tx.$executeRaw`
        UPDATE "Producto" p SET "cantidadStock" = s.total
        FROM (SELECT "productoId", SUM(cantidad) AS total FROM "StockDeposito" GROUP BY "productoId") s
        WHERE s."productoId" = p.id`;
    },
    { timeout: 120_000 },
  );

  const snapshot: SnapshotRow[] = [...agg.values()].map((v) => ({
    productoId: v.productoId,
    depositoId: v.depositoId,
    cantidad: v.cantidad,
    puntoReposicion: v.pr,
  }));

  return { stockRegistros: data.length, depositos: depIdByKey.size, deltas, snapshot, filasDescartadas };
}

/** Corrida diaria: sync productos + delta de stock + marca nuevos + bitácora. */
export async function runDailySync(
  prisma: PrismaClient,
  tipo: "CRON" | "MANUAL" = "CRON",
) {
  const inicio = Date.now();
  try {
    // 1) Productos (gratis) + detectar nuevos.
    const sync = await syncProductos(prisma, { fresh: false });

    // 2) Stock (pago) → deltas por (producto, depósito). El "anterior" se
    //    congela dentro de la transacción del pull: si esto falla, ni los
    //    flags ni cantidadStockAnterior quedan pisados a medias.
    const stock = await pullStockSnapshot(prisma, { guardarAnterior: true });
    const deltas = stock.deltas;

    // 3) Flags "nuevo" recién ahora, con la corrida ya exitosa.
    await prisma.producto.updateMany({ data: { esNuevo: false } });
    if (sync.nuevosCodigos.length) {
      await prisma.producto.updateMany({
        where: { teamplaceCodigo: { in: sync.nuevosCodigos } },
        data: { esNuevo: true },
      });
      await prisma.producto.updateMany({
        where: { teamplaceCodigo: { in: sync.nuevosCodigos }, primeraVezAt: null },
        data: { primeraVezAt: new Date() },
      });
    }

    // 4) Métricas de la corrida, desde los deltas por depósito.
    const productosConCambio = new Set(deltas.map((d) => d.productoId)).size;
    let alta = 0;
    let baja = 0;
    for (const d of deltas) {
      if (d.delta > 0) alta += d.delta;
      else baja += -d.delta;
    }

    const run = await prisma.syncRun.create({
      data: {
        tipo,
        ok: true,
        duracionMs: Date.now() - inicio,
        productosNuevos: sync.nuevosCodigos.length,
        productosConCambio,
        unidadesAlta: alta,
        unidadesBaja: baja,
        stockRegistros: stock.stockRegistros,
        depositos: stock.depositos,
      },
    });

    // 5) Histórico al detalle: una fila por cada (producto, depósito) que cambió.
    for (let i = 0; i < deltas.length; i += 500) {
      await prisma.historialStock.createMany({
        data: deltas.slice(i, i + 500).map((d) => ({
          syncRunId: run.id,
          fecha: run.ejecutadoAt,
          productoId: d.productoId,
          depositoId: d.depositoId,
          antes: d.antes,
          ahora: d.ahora,
          delta: d.delta,
        })),
      });
    }

    // 6) Serie de NIVELES para investigación operativa: el snapshot completo de
    //    la corrida (también los pares que no cambiaron). HistorialStock guarda
    //    los deltas; esto guarda cuánto HAY, consultable por fecha.
    for (let i = 0; i < stock.snapshot.length; i += 500) {
      await prisma.snapshotStock.createMany({
        data: stock.snapshot.slice(i, i + 500).map((s) => ({
          syncRunId: run.id,
          fecha: run.ejecutadoAt,
          productoId: s.productoId,
          depositoId: s.depositoId,
          cantidad: s.cantidad,
          puntoReposicion: s.puntoReposicion,
        })),
      });
    }
    return run;
  } catch (e) {
    return prisma.syncRun.create({
      data: { tipo, ok: false, error: e instanceof Error ? e.message : String(e), duracionMs: Date.now() - inicio },
    });
  }
}
