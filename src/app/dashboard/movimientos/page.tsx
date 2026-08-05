import Link from "next/link";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getMovimientos,
  getEntradasSalidasPorTipo,
  getEntradasSalidasPorDeposito,
  getResumenMovimientos,
  type Agg,
} from "@/lib/movimientos";
import { MovimientosTable } from "@/components/movimientos-table";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("es-AR");
const RANGOS = [7, 30, 90];

function AggTabla({
  titulo,
  descripcion,
  colEtiqueta,
  items,
}: {
  titulo: string;
  descripcion: string;
  colEtiqueta: string;
  items: Agg[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Sin movimientos en el período.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{colEtiqueta}</TableHead>
                  <TableHead className="w-20 text-right">Movs.</TableHead>
                  <TableHead className="w-28 text-right">Entradas</TableHead>
                  <TableHead className="w-28 text-right">Salidas</TableHead>
                  <TableHead className="w-28 text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.etiqueta}</div>
                      <div className="font-mono text-xs text-muted-foreground">{t.detalle}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{nf(t.movimientos)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {t.entradas > 0 ? `+${nf(t.entradas)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                      {t.salidas > 0 ? `−${nf(t.salidas)}` : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${t.neto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {t.neto >= 0 ? "+" : "−"}
                      {nf(Math.abs(t.neto))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const sp = await searchParams;
  const dias = RANGOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const desde = new Date(Date.now() - dias * 86_400_000);

  const [resumen, porTipo, porDeposito, movimientos] = await Promise.all([
    getResumenMovimientos(desde),
    getEntradasSalidasPorTipo(desde),
    getEntradasSalidasPorDeposito(desde),
    getMovimientos(desde, 500),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Movimientos de stock</h2>
          <p className="text-sm text-muted-foreground">
            Histórico al detalle por producto y depósito, detectado por las sincronizaciones.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {RANGOS.map((r) => (
            <Link
              key={r}
              href={`/dashboard/movimientos?dias=${r}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                r === dias ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r} días
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">Movimientos</CardDescription>
            <ArrowDownUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nf(resumen.total)}</div>
            <p className="mt-1 text-xs text-muted-foreground">en los últimos {dias} días</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">Entradas</CardDescription>
            <ArrowUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{nf(resumen.entradas)}</div>
            <p className="mt-1 text-xs text-muted-foreground">unidades sumadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">Salidas</CardDescription>
            <ArrowDown className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">−{nf(resumen.salidas)}</div>
            <p className="mt-1 text-xs text-muted-foreground">unidades restadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AggTabla
          titulo="Por tipo de producto"
          descripcion="Agrupado por familia (ONU, cables de fibra, conectores, etc.)."
          colEtiqueta="Tipo de producto"
          items={porTipo}
        />
        <AggTabla
          titulo="Por depósito"
          descripcion="Entradas y salidas en cada depósito / cuadrilla."
          colEtiqueta="Depósito"
          items={porDeposito}
        />
      </div>

      {/* Detalle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de movimientos</CardTitle>
          <CardDescription>
            {movimientos.length >= 500
              ? "Mostrando los 500 más recientes del período."
              : `${movimientos.length} movimientos en el período.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sin movimientos en el período.</p>
          ) : (
            <MovimientosTable movimientos={movimientos} conDeposito />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
