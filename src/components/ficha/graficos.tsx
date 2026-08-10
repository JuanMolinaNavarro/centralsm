// Gráficos SVG de la ficha: serie mensual de consumo, evolución de precios
// por proveedor y mapa de patrones (ADI × CV²). Componentes puros, sin hooks:
// se pueden renderizar en server o cliente.

import { UMBRAL_ADI, UMBRAL_CV2, type ProveedorFicha } from "@/lib/ficha";
import { nf } from "./constantes";

const SERIES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)", "var(--serie-5)"];

/** Valor compacto para etiquetas: 191000 → 191k, 4796 → 4,8k. */
const compacto = (v: number) =>
  v >= 10000
    ? Math.round(v / 1000) + "k"
    : v >= 1000
      ? (v / 1000).toFixed(1).replace(".", ",") + "k"
      : String(Math.round(v));

/** Barras mensuales de la serie de consumo (una sola serie → sin leyenda). */
export function GraficoSerie({ meses, serie }: { meses: string[]; serie: number[] }) {
  const n = serie.length;
  const w = 980;
  const h = 150;
  const bw = w / n;
  const max = Math.max(...serie, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Consumo mensual de los últimos 24 meses">
      {serie.map((v, i) => {
        const bh = (v / max) * (h - 50);
        const x = i * bw + 3;
        const y = h - 24 - bh;
        return (
          <g key={i}>
            {v > 0 && (
              <rect
                x={x.toFixed(1)}
                y={y.toFixed(1)}
                width={(bw - 6).toFixed(1)}
                height={Math.max(bh, 2).toFixed(1)}
                rx="3.5"
                fill="var(--serie-1)"
                opacity=".85"
              >
                <title>{`${meses[i]}: ${nf(v)}`}</title>
              </rect>
            )}
            {v > 0 && (
              <text
                x={(i * bw + bw / 2).toFixed(1)}
                y={(y - 5).toFixed(1)}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="600"
                fill="currentColor"
                className="font-mono"
              >
                {compacto(v)}
              </text>
            )}
            {i % 2 === 0 && (
              <text
                x={(i * bw + bw / 2).toFixed(1)}
                y={h - 8}
                textAnchor="middle"
                fontSize="8"
                fill="var(--muted-foreground)"
                className="font-mono"
              >
                {meses[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Interpola la serie de precios de un proveedor sobre los meses de la ventana. */
function serieDePrecios(precios: { fecha: string; precioUsd: number }[], mesesISO: string[]): (number | null)[] {
  if (precios.length === 0) return mesesISO.map(() => null);
  // Índice del mes (yyyy-mm) de cada precio dentro de la ventana.
  const clave = (f: string) => f.slice(0, 7);
  const idxDe = new Map(mesesISO.map((m, i) => [m, i]));
  const pts = precios
    .map((p) => ({ i: idxDe.get(clave(p.fecha)), v: p.precioUsd }))
    .filter((p): p is { i: number; v: number } => p.i !== undefined);
  if (pts.length === 0) {
    // Todos los precios caen fuera de la ventana: usar el último como plano.
    const ultimo = precios[precios.length - 1].precioUsd;
    return mesesISO.map(() => ultimo);
  }
  const out: (number | null)[] = new Array(mesesISO.length).fill(null);
  for (let i = 0; i < mesesISO.length; i++) {
    if (i <= pts[0].i) out[i] = pts[0].v;
    else if (i >= pts[pts.length - 1].i) out[i] = pts[pts.length - 1].v;
    else {
      for (let j = 0; j < pts.length - 1; j++) {
        if (i >= pts[j].i && i <= pts[j + 1].i) {
          const t = (i - pts[j].i) / (pts[j + 1].i - pts[j].i);
          out[i] = pts[j].v + t * (pts[j + 1].v - pts[j].v);
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Evolución del precio por proveedor (USD por unidad base), con el proveedor
 * seleccionado resaltado y los puntos en los precios realmente cargados.
 */
export function GraficoPrecios({
  proveedores,
  seleccionadoId,
  meses,
  mesesISO,
}: {
  proveedores: ProveedorFicha[];
  seleccionadoId: string | null;
  meses: string[];
  mesesISO: string[];
}) {
  const conPrecios = proveedores.filter((p) => p.precios.length > 0);
  if (conPrecios.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Cargá precios para ver la evolución.
      </p>
    );
  }
  const n = meses.length;
  const series = conPrecios.map((p) => serieDePrecios(p.precios, mesesISO));
  const todos = series.flat().filter((v): v is number => v !== null);
  const lo = Math.min(...todos);
  const hi = Math.max(...todos);
  const yMin = lo - (hi - lo || lo || 1) * 0.18;
  const yMax = hi + (hi - lo || hi || 1) * 0.22;
  const w = 980;
  const h = 210;
  const padL = 16;
  const padR = 16;
  const padB = 22;
  const X = (i: number) => padL + (i * (w - padL - padR)) / (n - 1);
  const Y = (v: number) => h - padB - ((v - yMin) * (h - padB - 14)) / (yMax - yMin);
  const path = (s: (number | null)[]) => {
    const pts = s.map((v, i) => (v === null ? null : [X(i), Y(v)])).filter(Boolean) as number[][];
    if (pts.length === 0) return "";
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const cx = ((p0[0] + p1[0]) / 2).toFixed(1);
      d += ` C${cx} ${p0[1].toFixed(1)} ${cx} ${p1[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    }
    return d;
  };
  const fmtP = (v: number) => (v < 10 ? nf(v, 2) : v < 100 ? nf(v, 1) : nf(v, 0));

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Evolución de precios por proveedor, en USD por unidad base">
        {conPrecios.map((p, i) => (
          <path
            key={p.id}
            d={path(series[i])}
            fill="none"
            stroke={SERIES[i % SERIES.length]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.id === seleccionadoId || !seleccionadoId ? 1 : 0.25}
          />
        ))}
        {conPrecios.map((p, i) =>
          p.precios.map((pr) => {
            const xi = mesesISO.indexOf(pr.fecha.slice(0, 7));
            if (xi < 0) return null;
            const x = X(xi);
            const y = Y(pr.precioUsd);
            const activo = p.id === seleccionadoId || !seleccionadoId;
            return (
              <g key={pr.id} opacity={activo ? 1 : 0.25}>
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.4" fill={SERIES[i % SERIES.length]} stroke="var(--background)" strokeWidth="1.6">
                  <title>{`${p.nombre} · ${pr.fecha}: ${fmtP(pr.precioUsd)} USD`}</title>
                </circle>
                <text
                  x={x.toFixed(1)}
                  y={(y - 9).toFixed(1)}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={SERIES[i % SERIES.length]}
                  stroke="var(--background)"
                  strokeWidth="3"
                  paintOrder="stroke"
                  className="font-mono"
                >
                  {fmtP(pr.precioUsd)}
                </text>
              </g>
            );
          }),
        )}
        {meses.map((m, i) =>
          i % 3 === 0 ? (
            <text key={m + i} x={X(i).toFixed(1)} y={h - 5} textAnchor="middle" fontSize="8.5" fill="var(--muted-foreground)" className="font-mono">
              {m}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
        {conPrecios.map((p, i) => {
          const s = series[i].filter((v): v is number => v !== null);
          const varPct = s.length > 1 && s[0] ? ((s[s.length - 1] / s[0] - 1) * 100) : null;
          return (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
              <i className="inline-block h-0.5 w-3.5 rounded" style={{ background: SERIES[i % SERIES.length] }} />
              {p.nombre}
              {varPct !== null && (
                <span className="font-mono">
                  {varPct >= 0 ? "+" : ""}
                  {nf(varPct, 0)}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Mapa de los cuatro patrones: ADI en x, CV² en y, con el artículo posicionado. */
export function CuadrantePatrones({ adi, cv2, hayConsumo }: { adi: number | null; cv2: number; hayConsumo: boolean }) {
  const w = 520;
  const h = 330;
  const pad = 14;
  const aMax = 2.6;
  const vMax = 1.6;
  const gap = 5;
  const X = (v: number) => pad + ((Math.min(Math.max(v, 1), aMax) - 1) / (aMax - 1)) * (w - 2 * pad);
  const Y = (v: number) => h - pad - (Math.min(Math.max(v, 0), vMax) / vMax) * (h - 2 * pad);
  const xT = X(UMBRAL_ADI);
  const yT = Y(UMBRAL_CV2);
  const cuadrantes = [
    { x1: pad, y1: yT, x2: xT, y2: h - pad, color: "var(--serie-3)", nombre: "SUAVE", accion: "la plataforma calcula sola" },
    { x1: xT, y1: yT, x2: w - pad, y2: h - pad, color: "var(--serie-1)", nombre: "INTERMITENTE", accion: "mínimo-máximo" },
    { x1: pad, y1: pad, x2: xT, y2: yT, color: "var(--serie-2)", nombre: "ERRÁTICA", accion: "mínimo-máximo con colchón" },
    { x1: xT, y1: pad, x2: w - pad, y2: yT, color: "var(--serie-5)", nombre: "GRUMOSA", accion: "compra contra pedido" },
  ];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Mapa de patrones de demanda (ADI horizontal, CV² vertical)">
      {cuadrantes.map((c) => (
        <g key={c.nombre}>
          <rect
            x={(c.x1 + gap).toFixed(1)}
            y={(c.y1 + gap).toFixed(1)}
            width={(c.x2 - c.x1 - 2 * gap).toFixed(1)}
            height={(c.y2 - c.y1 - 2 * gap).toFixed(1)}
            rx="14"
            fill={c.color}
            opacity=".13"
          />
          <text x={((c.x1 + c.x2) / 2).toFixed(1)} y={((c.y1 + c.y2) / 2 - 4).toFixed(1)} textAnchor="middle" fontWeight="700" fontSize="16" fill={c.color}>
            {c.nombre}
          </text>
          <text x={((c.x1 + c.x2) / 2).toFixed(1)} y={((c.y1 + c.y2) / 2 + 14).toFixed(1)} textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
            {c.accion}
          </text>
        </g>
      ))}
      {hayConsumo && adi !== null && (
        <g>
          <circle cx={X(adi).toFixed(1)} cy={Y(cv2).toFixed(1)} r="6.5" fill="var(--foreground)" stroke="var(--background)" strokeWidth="2.5" />
          <text
            x={X(adi).toFixed(1)}
            y={(Y(cv2) < pad + 44 ? Y(cv2) + 24 : Y(cv2) - 13).toFixed(1)}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="var(--foreground)"
            stroke="var(--background)"
            strokeWidth="3.5"
            paintOrder="stroke"
            className="font-mono"
          >
            este artículo
          </text>
        </g>
      )}
    </svg>
  );
}
