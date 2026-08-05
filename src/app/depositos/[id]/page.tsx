import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getDeposito } from "@/lib/depositos";
import { getMovimientos, getResumenMovimientos } from "@/lib/movimientos";
import { fechaHoraAR } from "@/lib/fecha";
import { InventarioTable } from "@/components/depositos/inventario-table";
import { MovimientosTable } from "@/components/movimientos-table";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("es-AR");

export default async function DepositoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deposito = await getDeposito(id);
  if (!deposito) notFound();

  const desde = new Date(Date.now() - 30 * 86_400_000);
  const [movs, resumenMov] = await Promise.all([
    getMovimientos(desde, 100, id),
    getResumenMovimientos(desde, id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/depositos" className="hover:text-foreground">
          Depósitos
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{deposito.nombre}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Warehouse className="mt-1 size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{deposito.nombre}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {deposito.codigo}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {deposito.items.length} productos ·{" "}
                {deposito.totalUnidades.toLocaleString("es-AR")} unidades
              </span>
            </div>
          </div>
        </div>
        {deposito.snapshotAt && (
          <span className="text-xs text-muted-foreground">
            snapshot de Teamplace al {fechaHoraAR(deposito.snapshotAt)}
          </span>
        )}
      </div>

      <Separator className="my-6" />

      {deposito.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Este depósito no tiene stock en el snapshot actual.
        </p>
      ) : (
        <InventarioTable items={deposito.items} />
      )}

      <Separator className="my-8" />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">Movimientos (últimos 30 días)</h2>
            <p className="text-sm text-muted-foreground">
              {nf(resumenMov.total)} movimientos ·{" "}
              <span className="text-emerald-600 dark:text-emerald-400">+{nf(resumenMov.entradas)}</span>{" "}
              <span className="text-red-600 dark:text-red-400">−{nf(resumenMov.salidas)}</span> unidades
            </p>
          </div>
          <Link href="/dashboard/movimientos" className="text-sm text-primary hover:underline">
            Ver todos los movimientos
          </Link>
        </div>

        {movs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin movimientos registrados en este depósito en los últimos 30 días.
          </p>
        ) : (
          <MovimientosTable movimientos={movs} />
        )}
      </section>
    </main>
  );
}
