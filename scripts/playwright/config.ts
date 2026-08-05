// Configuración del bot de carga de productos por UI (Playwright).
// ─────────────────────────────────────────────────────────────────────────────
// Valores VERIFICADOS en vivo sobre go.finneg.com (workspace MULTIMEDIOS) el
// 2026-07-23. El maestro "Productos" (3194 registros) vive en una vista cuyo
// contenido es una app JSP legacy de Teamplace embebida en un <iframe>.
// Ver docs/carga-productos-playwright.md para el detalle del flujo.
// ─────────────────────────────────────────────────────────────────────────────

/** Home tras el login. */
export const APP_URL = process.env.FINNEGANS_APP_URL ?? "https://go.finneg.com/home/externos";

/**
 * Vista del maestro de Productos. El `viewID` puede variar por workspace/empresa.
 * Cómo obtener el tuyo: login → buscador global (arriba) → escribí "producto" →
 * Enter → tile "Productos". La URL que abre es esta (copiá el viewID).
 */
export const PRODUCTOS_VIEW_URL =
  process.env.FINNEGANS_PRODUCTOS_URL ?? "https://go.finneg.com/mas/vista?viewID=104";

/**
 * Sesión cacheada (cookies). ⚠️ Sensible: va en .gitignore.
 * Configurable por env para que el worker en contenedor la guarde en un volumen.
 */
export const STORAGE_STATE_PATH =
  process.env.FINNEGANS_STATE_PATH ?? "scripts/playwright/.auth/finnegans-state.json";

/** Capturas de diagnóstico ante errores del bot. Configurable por la misma razón. */
export const RESULTADOS_DIR =
  process.env.FINNEGANS_RESULTADOS_DIR ?? "scripts/playwright/resultados";

/** El listado y el formulario de alta viven dentro de este iframe. */
export const IFRAME_SELECTOR = "iframe";

/**
 * Campos del formulario de alta ("Nuevo - Productos", pestaña General).
 *
 * El form legacy no pone id/name en los `<input>`, PERO cada campo está envuelto
 * en `<div class="widget" name="wdg_XXX">`. Ese nombre es semántico y estable
 * (mucho mejor que posicionar por `tabindex`, que se corre si agregan campos).
 * Verificado en vivo con scripts/playwright/inspeccionar-form.ts.
 */
export const WIDGETS = {
  codigo: "wdg_Codigo", // requerido
  nombre: "wdg_Nombre", // requerido
  descripcion: "wdg_Descripcion",
  tipo: "wdg_ProductoTipo", // requerido, default "Otros"
  peso: "wdg_Peso",
  volumen: "wdg_Volumen",
  rubro: "wdg_ProductoRubroID",
  marca: "wdg_Marca",
  familia: "wdg_ProductoFamiliaID",
  subfamilia: "wdg_ProductoSubFamiliaID",
} as const;

/** Checkboxes de la pestaña General (mismo esquema `wdg_*`). */
export const WIDGETS_CHECK = {
  activo: "wdg_activo",
  esStockeable: "wdg_EsStockeable",
  seVende: "wdg_SolapaSeVende",
  seCompra: "wdg_SolapaSeCompra",
  manejaRetenciones: "wdg_SolapaManejaRetenciones",
} as const;

/**
 * Links de acción dentro del iframe.
 * ⚠️ Usar SIEMPRE `exact: true` al buscarlos por rol: el match por defecto es
 * por substring, y "Guardar" también matchea "Guardar y nuevo" (ese bug hacía
 * que el bot guardara y abriera un form vacío, rompiendo la verificación).
 */
export const ACCIONES = {
  nuevo: "Nuevo",
  guardar: "Guardar",
  guardarYNuevo: "Guardar y nuevo",
  cerrar: "Cerrar",
  /** Aparece solo en registros YA guardados → es la señal de éxito del alta. */
  eliminar: "Eliminar",
  /** Diálogo "¿Desea guardar los cambios antes de salir?" → botón para descartar. */
  dialogoNo: "No",
} as const;

/** Pausa entre acciones: el form legacy hace postbacks y necesita respirar. */
export const ESPERA_MS = Number(process.env.FINNEGANS_PUSH_ESPERA_MS ?? 2000);

/** Locator del input de un campo, por el nombre de su widget contenedor. */
export function campoSelector(widget: string): string {
  return `div.widget[name="${widget}"] input`;
}
