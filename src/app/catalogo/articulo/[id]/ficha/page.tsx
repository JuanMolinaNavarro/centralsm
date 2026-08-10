import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getFichaData, getInactivosParaPredecesor } from "@/lib/ficha-data";
import { FichaTabs } from "@/components/ficha/ficha-tabs";
import { MaestroForm } from "@/components/ficha/maestro-form";
import { ProveedoresCard } from "@/components/ficha/proveedores-card";
import { LeadTimesCard } from "@/components/ficha/lead-times-card";
import { MovimientosPanel } from "@/components/ficha/movimientos-panel";
import { DerivadoPanel } from "@/components/ficha/derivado-panel";

export const dynamic = "force-dynamic";

export default async function FichaArticuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, inactivos] = await Promise.all([getFichaData(id), getInactivosParaPredecesor(id)]);
  if (!data) notFound();
  const p = data.producto;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-1">
        <Link
          href={`/catalogo/articulo/${p.id}`}
          className="w-fit text-sm text-muted-foreground hover:underline"
        >
          ← {p.nombre}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ficha de artículo</h1>
        <p className="text-sm text-muted-foreground">
          Las tres capas del dato: el maestro se completa una vez, los movimientos crecen con la operación y
          lo derivado se recalcula solo con cada cambio.
        </p>
      </div>

      {/* Identidad */}
      <div className="mt-6 flex flex-wrap items-baseline gap-4 rounded-lg border bg-card px-4 py-3">
        <span className="font-mono text-base font-medium text-primary">{p.codigoSku}</span>
        <span className="text-base font-semibold">{p.nombre}</span>
        <span className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {p.categoria.codigoSku} · {p.categoria.nombre}
          {p.origen && <Badge variant="outline">{p.origen.toLowerCase()}</Badge>}
          <Badge variant="outline">{p.unidadBase}</Badge>
        </span>
      </div>

      <FichaTabs
        articulo={
          <div className="flex flex-col gap-4 pt-2">
            <MaestroForm data={data} inactivos={inactivos} />
            <ProveedoresCard data={data} />
            <LeadTimesCard data={data} />
          </div>
        }
        movimientos={<div className="pt-2"><MovimientosPanel data={data} /></div>}
        derivado={<div className="pt-2"><DerivadoPanel data={data} /></div>}
      />
    </main>
  );
}
