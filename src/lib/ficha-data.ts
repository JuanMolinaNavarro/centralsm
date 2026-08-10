import { prisma } from "@/lib/prisma";
import {
  calcularFicha,
  checklistFicha,
  construirSerie,
  leadTimeDesdeHistorial,
  mesesVentana,
  valesAbiertos,
  type MovimientoFicha,
  type ProveedorFicha,
} from "@/lib/ficha";

// Arma todos los datos que necesita la ficha de un artículo: el maestro, los
// proveedores con sus precios, los movimientos (con el empalme del predecesor)
// y el cálculo derivado ya resuelto en el server.

const num = (d: { toString(): string } | null | undefined) =>
  d == null ? 0 : Number(d.toString());

const iso = (f: Date) => f.toISOString().slice(0, 10);

export type FichaData = NonNullable<Awaited<ReturnType<typeof getFichaData>>>;

export async function getFichaData(productoId: string) {
  // Solo interesan los movimientos de la ventana de análisis (24 meses + margen):
  // con el kardex importado un artículo puede tener miles de filas históricas.
  const desdeVentana = new Date();
  desdeVentana.setMonth(desdeVentana.getMonth() - 25);

  const p = await prisma.producto.findUnique({
    where: { id: productoId },
    include: {
      categoria: { select: { nombre: true, codigoSku: true } },
      proveedores: { orderBy: { orden: "asc" }, include: { precios: { orderBy: { fecha: "asc" } } } },
      movimientos: { where: { fecha: { gte: desdeVentana } }, orderBy: { fecha: "asc" } },
      leadTimes: { orderBy: { fecha: "asc" } },
      predecesor: {
        select: {
          id: true,
          codigoSku: true,
          nombre: true,
          movimientos: { where: { fecha: { gte: desdeVentana } }, orderBy: { fecha: "asc" } },
        },
      },
    },
  });
  if (!p) return null;

  const movimientos: MovimientoFicha[] = p.movimientos.map((m) => ({
    id: m.id,
    fecha: iso(m.fecha),
    tipo: m.tipo,
    demanda: m.demanda,
    solicitado: num(m.solicitado),
    entregado: num(m.entregado),
    destino: m.destino,
    pedido: m.pedido,
    documento: m.documento,
    deposito: m.deposito,
    empresa: m.empresa,
    fuente: m.fuente,
  }));

  // Empalme: los consumos del artículo predecesor cuentan para la serie (el
  // nuevo lo reemplaza), pero no se muestran como movimientos editables.
  const movsPredecesor: MovimientoFicha[] = (p.predecesor?.movimientos ?? [])
    .filter((m) => m.tipo === "CONSUMO")
    .map((m) => ({
      id: m.id,
      fecha: iso(m.fecha),
      tipo: m.tipo,
      demanda: m.demanda,
      solicitado: num(m.solicitado),
      entregado: num(m.entregado),
      destino: m.destino,
      pedido: m.pedido,
    }));

  const proveedores: ProveedorFicha[] = p.proveedores.map((pr) => ({
    id: pr.id,
    nombre: pr.nombre,
    unidadCompra: pr.unidadCompra,
    factorCompra: num(pr.factorCompra),
    unidadConsumo: pr.unidadConsumo,
    factorConsumo: num(pr.factorConsumo),
    loteMinimo: num(pr.loteMinimo),
    multiplo: num(pr.multiplo),
    precios: pr.precios.map((x) => ({ id: x.id, fecha: iso(x.fecha), precioUsd: num(x.precioUsd) })),
  }));

  const seleccionado =
    proveedores.find((x) => x.id === p.proveedorSeleccionadoId) ?? proveedores[0] ?? null;
  const ultimoPrecio = seleccionado?.precios.at(-1) ?? null;

  const { medio: ltMedio, desvio: ltDesvio } = leadTimeDesdeHistorial(p.leadTimes.map((l) => l.dias));

  const stock = num(p.cantidadStock);
  const serie = construirSerie([...movsPredecesor, ...movimientos]);
  const calculo = calcularFicha({
    serie,
    stock,
    enTransito: num(p.enTransito),
    costo: ultimoPrecio?.precioUsd ?? null,
    ltMedio,
    ltDesvio,
    loteMinimo: seleccionado?.loteMinimo ?? null,
    multiplo: seleccionado?.multiplo ?? null,
    kitCantidad: p.kitCantidad ? num(p.kitCantidad) : null,
    instalacionesMes: p.instalacionesMes,
  });

  const checklist = checklistFicha({
    unidadBase: p.unidadStock,
    factorCompra: seleccionado?.factorCompra ?? null,
    costo: ultimoPrecio?.precioUsd ?? null,
    costoFecha: ultimoPrecio?.fecha ?? null,
    criticidad: p.criticidad,
    mesesActivos: calculo.mesesActivos,
    ltMedio,
    ltDesvio,
    loteMinimo: seleccionado?.loteMinimo ?? null,
    multiplo: seleccionado?.multiplo ?? null,
  });

  return {
    producto: {
      id: p.id,
      codigoSku: p.codigoSku,
      nombre: p.nombre,
      estado: p.estado,
      unidadBase: p.unidadStock,
      stock,
      enTransito: num(p.enTransito),
      categoria: p.categoria,
      criticidad: p.criticidad,
      kitNombre: p.kitNombre,
      kitCantidad: p.kitCantidad ? num(p.kitCantidad) : null,
      predecesorId: p.predecesorId,
      predecesor: p.predecesor
        ? { id: p.predecesor.id, codigoSku: p.predecesor.codigoSku, nombre: p.predecesor.nombre }
        : null,
      sustitutos: p.sustitutos,
      origen: p.origen,
      estadoItem: p.estadoItem,
      requiereAutoelevador: p.requiereAutoelevador,
      vidaUtilMeses: p.vidaUtilMeses,
      instalacionesMes: p.instalacionesMes,
      tipoCosto: p.tipoCosto,
      entidades: p.entidades,
      volumen: num(p.finnegansVolumen),
      peso: num(p.finnegansPeso),
      proveedorSeleccionadoId: seleccionado?.id ?? null,
    },
    proveedores,
    seleccionado,
    costo: ultimoPrecio?.precioUsd ?? null,
    costoVigencia: ultimoPrecio?.fecha ?? null,
    movimientos,
    consumosPredecesor: movsPredecesor.length,
    leadTimes: p.leadTimes.map((l) => ({ id: l.id, dias: l.dias, fecha: iso(l.fecha) })),
    ltMedio,
    ltDesvio,
    meses: mesesVentana().map((m) => m.etiqueta),
    mesesISO: mesesVentana().map((m) => `${m.anio}-${String(m.mes + 1).padStart(2, "0")}`),
    serie,
    calculo,
    vales: valesAbiertos(movimientos),
    checklist,
  };
}

/** Artículos inactivos disponibles como predecesor (para el selector). */
export async function getInactivosParaPredecesor(excluirId: string) {
  return prisma.producto.findMany({
    where: { estado: "INACTIVO", id: { not: excluirId } },
    select: { id: true, codigoSku: true, nombre: true },
    orderBy: { codigoSku: "asc" },
    take: 500,
  });
}
