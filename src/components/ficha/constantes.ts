// Etiquetas y textos explicativos de la ficha operativa (espejan el prototipo).

import type { TipoDemandaFicha, TipoMovimientoFicha } from "@/lib/ficha";

export const nf = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || !isFinite(v)
    ? "—"
    : Number(v).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const TIPO_MOVIMIENTO: Record<TipoMovimientoFicha, string> = {
  CONSUMO: "Consumo",
  TRANSFERENCIA: "Transferencia",
  DEVOLUCION: "Devolución",
  AJUSTE: "Ajuste",
  RECEPCION_COMPRA: "Recepción de compra",
  DEVOLUCION_COMPRA: "Devolución a proveedor",
  SALIDA_PROYECTO: "Salida a proyecto",
  REINGRESO_PROYECTO: "Reingreso de proyecto",
};

export const TIPO_DEMANDA: Record<TipoDemandaFicha, string> = {
  RECURRENTE: "Recurrente",
  OBRA: "Obra",
  URGENTE: "Urgente",
  NA: "—",
};

export const TIPO_COSTO_LABEL: Record<string, string> = {
  REPOSICION: "reposición",
  ULTIMA_COMPRA: "última compra",
  PROMEDIO_PONDERADO: "promedio ponderado",
  ESTANDAR: "estándar",
};

export const EXPL_COSTO: Record<string, string> = {
  REPOSICION:
    "Cuánto costaría volver a comprarlo hoy. Es el que usan el ABC y la sugerencia de compra.",
  ULTIMA_COMPRA: "El precio de la última orden pagada. Sirve para auditar contra factura.",
  PROMEDIO_PONDERADO:
    "Promedio de las compras, pesado por cantidad. Valoriza el stock que realmente hay en el depósito.",
  ESTANDAR: "Valor fijo de administración. Sirve para presupuestar y medir desvíos, no para el ABC.",
};

/** ¿Qué es / efecto en el cálculo / ejemplo, por tipo de movimiento. */
export const EXPL_MOVIMIENTO: {
  tipo: TipoMovimientoFicha;
  queEs: string;
  efecto: string;
  ejemplo: string;
}[] = [
  {
    tipo: "CONSUMO",
    queEs: "Una salida real hacia una instalación, un servicio o una venta. El artículo no vuelve.",
    efecto:
      "Es el único tipo que entra en la serie de demanda. Todo el patrón, la cobertura y la reposición nacen de estas filas.",
    ejemplo: "40 conectores entregados a los técnicos para las instalaciones del día.",
  },
  {
    tipo: "TRANSFERENCIA",
    queEs: "Stock que cambia de depósito o sucursal, pero sigue siendo de la empresa.",
    efecto:
      "Excluida. No es demanda: si se contara, una bobina enviada a otra sucursal inflaría el promedio como si se hubiera consumido.",
    ejemplo: "2 bobinas de fibra enviadas del Depósito Villaroel al Depósito Salta.",
  },
  {
    tipo: "DEVOLUCION",
    queEs: "Material que vuelve al depósito desde un cliente o un técnico.",
    efecto: "Excluida de la serie. Suma stock físico, pero no dice nada de la demanda.",
    ejemplo: "Una ONU retirada de un abonado que se dio de baja.",
  },
  {
    tipo: "AJUSTE",
    queEs: "Una corrección por conteo físico: faltante o sobrante de inventario.",
    efecto: "Excluida. Es un error que se sincera, no una necesidad de nadie.",
    ejemplo: "El conteo encontró 12 unidades menos que el sistema.",
  },
  {
    tipo: "RECEPCION_COMPRA",
    queEs: "Entrada de mercadería por una orden de compra (o parte de producción).",
    efecto:
      "Excluida de la demanda: es abastecimiento, no consumo. Cruzada con la fecha de la orden alimenta el lead time.",
    ejemplo: "Llegaron 20 cajas de conectores de la OC de FiberNac.",
  },
  {
    tipo: "DEVOLUCION_COMPRA",
    queEs: "Mercadería que se devuelve al proveedor (falla, error de pedido).",
    efecto: "Excluida. Es una corrección del abastecimiento, no demanda.",
    ejemplo: "Se devolvieron 3 ONUs falladas al distribuidor.",
  },
  {
    tipo: "SALIDA_PROYECTO",
    queEs:
      "Equipos que salen para un proyecto propio y eventual, con retorno esperado. El stock sigue siendo de la empresa: está «en calle».",
    efecto:
      "Excluida de la demanda. Genera un vale abierto que se ve en «En calle» hasta que vuelva todo.",
    ejemplo: "6 ONUs y un switch para dar internet en un evento de un fin de semana.",
  },
  {
    tipo: "REINGRESO_PROYECTO",
    queEs: "La vuelta de una salida a proyecto, total o parcial.",
    efecto:
      "Se enlaza con su salida por el mismo N° de vale (columna Pedido). La diferencia entre lo salido y lo reingresado es lo que sigue en calle — o lo que se perdió y habrá que ajustar.",
    ejemplo: "Del evento volvieron 4 de las 6 ONUs; el vale queda abierto con 2 sin devolver.",
  },
];

export const EXPL_DEMANDA: { tipo: TipoDemandaFicha; queEs: string; paraQue: string }[] = [
  {
    tipo: "RECURRENTE",
    queEs: "La demanda normal del día a día: instalaciones, mantenimiento, reparaciones.",
    paraQue: "Es la única que conviene usar para pronosticar y calcular reposición.",
  },
  {
    tipo: "OBRA",
    queEs:
      "Consumo puntual de un proyecto grande y planificado (un tendido nuevo, una ampliación de red).",
    paraQue:
      "Se marca aparte porque es un pico que se conoce de antemano: si se mezcla con lo recurrente, infla el promedio y hace comprar de más todos los meses.",
  },
  {
    tipo: "URGENTE",
    queEs: "Un pedido fuera de ciclo que no pudo esperar la reposición normal.",
    paraQue:
      "Marca dónde falló el stock. Contarlas por artículo es la evidencia para decidir qué merece stock de seguridad.",
  },
  {
    tipo: "NA",
    queEs:
      "No aplica: se usa en los movimientos que no son Consumo (transferencias, ajustes, salidas a proyecto).",
    paraQue: "",
  },
];
