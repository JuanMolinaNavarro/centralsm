// Cliente de la API de Teamplace / Finnegans.
// ⚠️ Solo servidor: usa CLIENT_ID/SECRET. Nunca importar desde un componente cliente.
// Doc: docs/API-Teamplace-Finnegans.md

function cfg() {
  const tokenUrl =
    process.env.TEAMPLACE_TOKEN_URL ?? "https://api.teamplace.finneg.com/api/oauth/token";
  const baseUrl = process.env.TEAMPLACE_BASE_URL ?? "https://api.finneg.com/api";
  const clientId = process.env.TEAMPLACE_CLIENT_ID;
  const clientSecret = process.env.TEAMPLACE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan TEAMPLACE_CLIENT_ID / TEAMPLACE_CLIENT_SECRET en el entorno (.env).",
    );
  }
  return { tokenUrl, baseUrl, clientId, clientSecret };
}

// El token dura unos minutos; lo cacheamos con un margen conservador.
const TOKEN_TTL_MS = 4 * 60 * 1000;
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Obtiene (y cachea) un ACCESS_TOKEN. `force` ignora la cache. */
export async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  const { tokenUrl, clientId, clientSecret } = cfg();
  const url =
    `${tokenUrl}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = (await res.text()).trim();
  // Éxito = token en texto plano. Error = JSON tipo {"error":"credentials not found"}.
  if (!res.ok || text.startsWith("{")) {
    throw new Error(`No se pudo obtener el token de Teamplace: ${text || res.status}`);
  }
  cachedToken = { value: text, expiresAt: Date.now() + TOKEN_TTL_MS };
  return text;
}

type Params = Record<string, string | number | boolean | undefined>;

/** GET genérico a la API. Agrega ACCESS_TOKEN y reintenta 1 vez si el token expiró. */
async function apiGet<T>(path: string, params: Params = {}, _retry = false): Promise<T> {
  const { baseUrl } = cfg();
  const token = await getToken();
  const qs = new URLSearchParams({ ACCESS_TOKEN: token });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }

  const res = await fetch(`${baseUrl}${path}?${qs.toString()}`, { cache: "no-store" });
  const raw = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  const errorMsg =
    data && typeof data === "object" && "error" in data
      ? String((data as { error: unknown }).error)
      : null;

  // Token vencido/ inválido → refrescar y reintentar una sola vez.
  if (!_retry && errorMsg && /invalid token/i.test(errorMsg)) {
    await getToken(true);
    return apiGet<T>(path, params, true);
  }
  if (!res.ok || errorMsg) {
    throw new Error(`Teamplace ${path} falló: ${errorMsg ?? res.status}`);
  }
  return data as T;
}

// --------------------------------------------------------------- Productos

export type TeamplaceProductoResumen = {
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
};

/** Lista resumida de productos. `updatedSince` en formato yyyy-MM-dd. */
export function listarProductos(opts: { updatedSince?: string } = {}) {
  return apiGet<TeamplaceProductoResumen[]>("/producto/list", {
    updatedSince: opts.updatedSince,
  });
}

/** Detalle completo (ProductoVO) de un producto por su código. */
export function getProducto(codigo: string) {
  return apiGet<Record<string, unknown>>(`/producto/${encodeURIComponent(codigo)}`);
}

// ------------------------------------------------------------------- Stock

/** Reporte de stock por depósito. `MonedaID` es obligatorio (ej. "PES"). */
export function getStockPorDeposito(opts: {
  MonedaID: string;
  producto?: string;
  deposito?: string;
  fecha?: string;
  soloStockNoCero?: boolean;
}) {
  return apiGet<Array<Record<string, unknown>>>("/reports/stockDeposito", {
    PARAMWEBREPORT_MonedaID: opts.MonedaID,
    PARAMWEBREPORT_producto: opts.producto,
    PARAMWEBREPORT_deposito: opts.deposito,
    PARAMWEBREPORT_fecha: opts.fecha,
    PARAMWEBREPORT_soloStockNoCero: opts.soloStockNoCero,
  });
}
