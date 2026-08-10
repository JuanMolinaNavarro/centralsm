// Motor de cálculo de la ficha de investigación operativa.
//
// Todo lo de este archivo es PURO (sin Prisma ni React): recibe números y
// devuelve números, así se puede usar igual en el server y en el cliente.
// Las fórmulas y umbrales replican el prototipo docs/ficha (Syntetos-Boylan
// para el patrón de demanda, stock de seguridad con demanda y lead time
// inciertos, sugerencia q redondeada a las condiciones del proveedor).

/** Ventana de análisis: 24 meses ≈ 730 días. */
export const MESES_VENTANA = 24;
export const DIAS_VENTANA = 730;
/** Nivel de servicio 95% → Z = 1,65. */
export const Z_SERVICIO = 1.65;
/** Umbral ADI: hasta 1,32 la demanda se considera frecuente. */
export const UMBRAL_ADI = 1.32;
/** Umbral CV²: hasta 0,49 las cantidades se consideran parejas. */
export const UMBRAL_CV2 = 0.49;
/** Desvío del rendimiento del kit que se considera normal (±25%). */
export const UMBRAL_KIT = 25;

export type TipoMovimientoFicha =
  | "CONSUMO"
  | "TRANSFERENCIA"
  | "DEVOLUCION"
  | "AJUSTE"
  | "RECEPCION_COMPRA"
  | "DEVOLUCION_COMPRA"
  | "SALIDA_PROYECTO"
  | "REINGRESO_PROYECTO";

export type TipoDemandaFicha = "RECURRENTE" | "OBRA" | "URGENTE" | "NA";

/** Movimiento ya serializado (Decimal → number, DateTime → ISO). */
export type MovimientoFicha = {
  id: string;
  fecha: string; // ISO yyyy-mm-dd
  tipo: TipoMovimientoFicha;
  demanda: TipoDemandaFicha;
  solicitado: number;
  entregado: number;
  destino: string | null;
  pedido: string | null;
  /// Documento del ERP y origen del dato (null = cargado a mano).
  documento?: string | null;
  deposito?: string | null;
  empresa?: string | null;
  fuente?: string | null;
};

export type PrecioFicha = { id: string; fecha: string; precioUsd: number };

export type ProveedorFicha = {
  id: string;
  nombre: string;
  unidadCompra: string;
  factorCompra: number;
  unidadConsumo: string;
  factorConsumo: number;
  loteMinimo: number;
  multiplo: number;
  precios: PrecioFicha[]; // ordenados por fecha asc
};

export type Patron = "Suave" | "Errática" | "Intermitente" | "Grumosa" | "Sin movimiento";

export const POLITICA: Record<Patron, { nombre: string; detalle: string }> = {
  Suave: {
    nombre: "Fórmula automática",
    detalle:
      "La plataforma calcula sola cuándo y cuánto comprar: es lo que se ve en el bloque «Qué comprar».",
  },
  Errática: {
    nombre: "Mínimo-máximo con colchón",
    detalle:
      "Compras define un piso y un techo, con colchón más grande y revisión frecuente: el promedio engaña.",
  },
  Intermitente: {
    nombre: "Mínimo-máximo",
    detalle:
      "Al tocar el mínimo se repone hasta el máximo. Sin fórmula: no se stockea de más algo que casi no se mueve.",
  },
  Grumosa: {
    nombre: "Compra contra pedido",
    detalle: "No se stockea por fórmula: se compra cuando hay pedido u obra que lo justifique.",
  },
  "Sin movimiento": {
    nombre: "Sin política definida",
    detalle:
      "No hubo consumo en la ventana: revisar si el artículo sigue vigente o corresponde darlo de baja.",
  },
};

export const EXPLICACION_PATRON: Record<Patron, string> = {
  Suave:
    "Demanda frecuente y de cantidades parejas: se puede pronosticar y aplicar fórmulas de reposición.",
  Errática:
    "Aparece casi todos los meses, pero las cantidades pegan saltos grandes: el promedio engaña. Va por mínimo-máximo con colchón.",
  Intermitente:
    "Hay meses sin consumo con frecuencia, pero cuando aparece las cantidades son parecidas. Va por mínimo-máximo.",
  Grumosa:
    "Aparece poco y, cuando aparece, salta cualquier cantidad: la peor para pronosticar. Compra contra pedido.",
  "Sin movimiento": "No hubo consumo en toda la ventana.",
};

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Los 24 (año, mes) de la ventana, terminando en el mes actual. */
export function mesesVentana(hasta = new Date()): { anio: number; mes: number; etiqueta: string }[] {
  const out: { anio: number; mes: number; etiqueta: string }[] = [];
  for (let i = MESES_VENTANA - 1; i >= 0; i--) {
    const d = new Date(hasta.getFullYear(), hasta.getMonth() - i, 1);
    out.push({
      anio: d.getFullYear(),
      mes: d.getMonth(),
      etiqueta: `${MES_CORTO[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`,
    });
  }
  return out;
}

/**
 * Serie mensual de demanda: SOLO los movimientos de tipo CONSUMO, agregados
 * por mes calendario, sumando lo ENTREGADO. Todo lo demás mueve stock pero
 * no es demanda. Si hay predecesor, sus consumos vienen incluidos en `movs`
 * (el empalme se hace al armar los datos).
 */
export function construirSerie(movs: MovimientoFicha[], hasta = new Date()): number[] {
  const meses = mesesVentana(hasta);
  const idx = new Map(meses.map((m, i) => [`${m.anio}-${m.mes}`, i]));
  const serie = new Array(MESES_VENTANA).fill(0);
  for (const m of movs) {
    if (m.tipo !== "CONSUMO") continue;
    const f = new Date(m.fecha + "T00:00:00");
    const i = idx.get(`${f.getFullYear()}-${f.getMonth()}`);
    if (i !== undefined) serie[i] += m.entregado || 0;
  }
  return serie;
}

/** Promedio y desvío muestral del historial de lead times (días). */
export function leadTimeDesdeHistorial(dias: number[]): { medio: number | null; desvio: number | null } {
  if (dias.length === 0) return { medio: null, desvio: null };
  const media = dias.reduce((a, b) => a + b, 0) / dias.length;
  const desvio =
    dias.length > 1
      ? Math.sqrt(dias.reduce((ac, x) => ac + (x - media) ** 2, 0) / (dias.length - 1))
      : 0;
  return { medio: Math.round(media), desvio: Math.round(desvio) };
}

export type EntradaCalculo = {
  serie: number[];
  stock: number;
  enTransito: number;
  /** USD por unidad base (último precio del proveedor seleccionado). */
  costo: number | null;
  ltMedio: number | null;
  ltDesvio: number | null;
  loteMinimo: number | null;
  multiplo: number | null;
  kitCantidad: number | null;
  instalacionesMes: number | null;
};

export type ResultadoCalculo = {
  // Serie y patrón
  total: number;
  mesesActivos: number; // k
  media: number; // de los meses activos
  desvio: number; // sd muestral de los meses activos
  adi: number | null; // n / k
  cv2: number; // (sd / media)²
  patron: Patron;
  // Estado de hoy
  consumoDiario: number; // total / 730
  coberturaDias: number | null; // stock / diario
  // Reposición (solo patrón Suave con lead time)
  stockSeguridad: number | null;
  puntoPedido: number | null;
  necesidad: number | null;
  sugerenciaQ: number | null;
  // Valor
  valorConsumido: number | null;
  valorInmovilizado: number | null;
  // Kit
  kitTeoricoMes: number | null;
  realMes: number; // total / 24
  kitRendimientoPct: number | null; // (real/teórico − 1) · 100
};

export function calcularFicha(e: EntradaCalculo): ResultadoCalculo {
  const activos = e.serie.filter((x) => x > 0);
  const k = activos.length;
  const total = e.serie.reduce((a, b) => a + b, 0);
  const media = k ? total / k : 0;
  const desvio =
    k > 1 ? Math.sqrt(activos.reduce((ac, x) => ac + (x - media) ** 2, 0) / (k - 1)) : 0;
  const adi = k ? MESES_VENTANA / k : null;
  const cv2 = media ? (desvio / media) ** 2 : 0;

  let patron: Patron = "Sin movimiento";
  if (k > 0 && adi !== null) {
    if (adi < UMBRAL_ADI && cv2 < UMBRAL_CV2) patron = "Suave";
    else if (adi < UMBRAL_ADI) patron = "Errática";
    else if (cv2 < UMBRAL_CV2) patron = "Intermitente";
    else patron = "Grumosa";
  }

  const consumoDiario = total / DIAS_VENTANA;
  const coberturaDias = consumoDiario > 0 ? e.stock / consumoDiario : null;

  // Colchón contra los DOS imprevistos: demanda que sube (σ diaria) y
  // proveedor que tarda (σ del lead time). Solo tiene sentido con patrón
  // Suave: para el resto el promedio engaña y la fórmula daría precisión falsa.
  const desvioDiario = desvio / Math.sqrt(30.4);
  const lt = e.ltMedio ?? 0;
  const ltd = e.ltDesvio ?? 0;
  const stockSeguridad =
    lt > 0 && patron === "Suave"
      ? Z_SERVICIO * Math.sqrt(lt * desvioDiario ** 2 + consumoDiario ** 2 * ltd ** 2)
      : null;
  const puntoPedido = stockSeguridad !== null ? consumoDiario * lt + stockSeguridad : null;
  const necesidad = puntoPedido !== null ? puntoPedido - e.stock - e.enTransito : null;

  // La necesidad traducida a lo que el proveedor acepta vender.
  let sugerenciaQ: number | null = null;
  if (necesidad !== null && necesidad > 0 && e.multiplo) {
    sugerenciaQ = Math.max(e.loteMinimo ?? 0, Math.ceil(necesidad / e.multiplo) * e.multiplo);
  }

  const costo = e.costo ?? null;
  const valorConsumido = costo !== null ? total * costo : null;
  const valorInmovilizado = costo !== null ? e.stock * costo : null;

  const kitTeoricoMes =
    e.kitCantidad && e.instalacionesMes ? e.kitCantidad * e.instalacionesMes : null;
  const realMes = total / MESES_VENTANA;
  const kitRendimientoPct = kitTeoricoMes ? (realMes / kitTeoricoMes - 1) * 100 : null;

  return {
    total,
    mesesActivos: k,
    media,
    desvio,
    adi,
    cv2,
    patron,
    consumoDiario,
    coberturaDias,
    stockSeguridad,
    puntoPedido,
    necesidad,
    sugerenciaQ,
    valorConsumido,
    valorInmovilizado,
    kitTeoricoMes,
    realMes,
    kitRendimientoPct,
  };
}

export type Vale = {
  pedido: string;
  destino: string;
  fecha: string;
  salida: number;
  retorno: number;
  saldo: number;
};

/**
 * Vales de salida a proyectos eventuales: enlaza SALIDA_PROYECTO con
 * REINGRESO_PROYECTO por el mismo N° de pedido. Lo salido y no devuelto
 * sigue siendo stock de la empresa pero está "en calle".
 */
export function valesAbiertos(movs: MovimientoFicha[]): Vale[] {
  const map = new Map<string, Vale>();
  for (const m of movs) {
    if (m.tipo !== "SALIDA_PROYECTO" && m.tipo !== "REINGRESO_PROYECTO") continue;
    const id = m.pedido || "(sin pedido)";
    let v = map.get(id);
    if (!v) {
      v = { pedido: id, destino: "", fecha: m.fecha, salida: 0, retorno: 0, saldo: 0 };
      map.set(id, v);
    }
    if (m.tipo === "SALIDA_PROYECTO") {
      v.salida += m.entregado || 0;
      v.destino = m.destino ?? v.destino;
    } else {
      v.retorno += m.entregado || 0;
    }
  }
  return [...map.values()].map((v) => ({ ...v, saldo: v.salida - v.retorno }));
}

export type ItemChecklist = { ok: boolean; titulo: string; porQue: string };

/** Qué falta para que el cálculo sea confiable. */
export function checklistFicha(input: {
  unidadBase: string | null;
  factorCompra: number | null;
  costo: number | null;
  costoFecha: string | null;
  criticidad: number | null;
  mesesActivos: number;
  ltMedio: number | null;
  ltDesvio: number | null;
  loteMinimo: number | null;
  multiplo: number | null;
}): ItemChecklist[] {
  return [
    {
      ok: !!input.unidadBase && !!input.factorCompra,
      titulo: "Unidad base y factores cargados",
      porQue: "Sin esto las cantidades de los movimientos no son sumables",
    },
    {
      ok: input.costo !== null && input.costo > 0,
      titulo: "Costo unitario cargado",
      porQue: "Sin costo no hay clase por valor, solo por cantidad",
    },
    {
      ok: !!input.costoFecha,
      titulo: "Vigencia del costo conocida",
      porQue: "Nadie sabe si el número está vencido",
    },
    {
      ok: !!input.criticidad,
      titulo: "Criticidad operativa definida",
      porQue: "El ABC puede dejar caer un artículo barato que frena instalaciones",
    },
    {
      ok: input.mesesActivos > 0,
      titulo: "Hay movimientos de tipo Consumo",
      porQue: "Sin serie no hay política ni cobertura",
    },
    {
      ok: input.ltMedio !== null && input.ltDesvio !== null,
      titulo: "Lead time medio y desvío cargados",
      porQue: "Sin desvío no hay colchón de seguridad defendible",
    },
    {
      ok: !!input.loteMinimo && !!input.multiplo,
      titulo: "Lote mínimo y múltiplo cargados",
      porQue: "La sugerencia de compra no se puede ejecutar",
    },
  ];
}
