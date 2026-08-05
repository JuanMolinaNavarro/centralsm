import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  getResumen,
  getUltimaSync,
  getProductosNuevos,
  getCambiosStock,
  getSyncRuns,
} from "@/lib/dashboard";
import { fechaHoraAR } from "@/lib/fecha";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("es-AR");
const fecha = fechaHoraAR;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const [resumen, ultima, nuevos, cambios, runs] = await Promise.all([
    getResumen(),
    getUltimaSync(),
    getProductosNuevos(),
    getCambiosStock(),
    getSyncRuns(8),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Última sincronización"
          value={ultima ? fecha(ultima.ejecutadoAt) : "—"}
          sub={ultima ? `${ultima.tipo} · ${ultima.ok ? "OK" : "con error"}` : "sin corridas aún"}
          icon={Clock}
        />
        <StatCard
          label="Productos nuevos"
          value={nf(resumen.nuevos)}
          sub="en la última corrida"
          icon={Sparkles}
        />
        <StatCard
          label="Con cambios de stock"
          value={ultima ? nf(ultima.productosConCambio) : "0"}
          sub={
            ultima
              ? `+${nf(Number(ultima.unidadesAlta))} / −${nf(Number(ultima.unidadesBaja))} unidades`
              : undefined
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Productos totales"
          value={nf(resumen.totalProductos)}
          sub={`${nf(resumen.conStock)} con stock`}
          icon={Package}
        />
      </div>

      {/* Productos nuevos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> Productos nuevos
          </CardTitle>
          <CardDescription>Aparecieron en Teamplace en la última sincronización.</CardDescription>
        </CardHeader>
        <CardContent>
          {nuevos.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No hubo productos nuevos.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="w-28 text-right">Stock</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nuevos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.codigoSku}</TableCell>
                      <TableCell>
                        <Link href={`/catalogo/articulo/${p.id}`} className="hover:underline">
                          {p.nombre}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.categoria.nombre}</TableCell>
                      <TableCell className="text-right font-mono">
                        {nf(Number(p.cantidadStock.toString()))}
                      </TableCell>
                      <TableCell>
                        <Badge className="gap-1">
                          <Sparkles className="size-3" /> Nuevo
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cambios de stock */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambios de stock</CardTitle>
          <CardDescription>
            Diferencia respecto del snapshot anterior (día a día).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cambios.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sin cambios desde la corrida anterior.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-28 text-right">Antes</TableHead>
                    <TableHead className="w-28 text-right">Ahora</TableHead>
                    <TableHead className="w-32 text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cambios.map((c) => {
                    const sube = c.delta > 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono">{c.codigoSku}</TableCell>
                        <TableCell>
                          <Link href={`/catalogo/articulo/${c.id}`} className="hover:underline">
                            {c.nombre}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {nf(c.antes)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{nf(c.ahora)}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-semibold ${sube ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {sube ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                            {sube ? "+" : "−"}
                            {nf(Math.abs(c.delta))}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de sincronizaciones</CardTitle>
          <CardDescription>El cron corre todos los días a las 2 AM (hora Argentina).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Nuevos</TableHead>
                  <TableHead className="text-right">Cambios</TableHead>
                  <TableHead className="text-right">+ / −</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{fecha(r.ejecutadoAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{nf(r.productosNuevos)}</TableCell>
                    <TableCell className="text-right font-mono">{nf(r.productosConCambio)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{nf(Number(r.unidadesAlta))}
                      </span>{" "}
                      /{" "}
                      <span className="text-red-600 dark:text-red-400">
                        −{nf(Number(r.unidadesBaja))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.duracionMs != null ? `${(r.duracionMs / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.ok ? "default" : "destructive"}>
                        {r.ok ? "OK" : "Error"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Todavía no hubo sincronizaciones.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
