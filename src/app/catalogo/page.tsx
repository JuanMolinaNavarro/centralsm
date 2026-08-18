import Link from "next/link";
import { ArrowRight, BadgeCheck, ListChecks } from "lucide-react";
import { contarPendientes, getMacroCategorias } from "@/lib/catalogo";
import { Button } from "@/components/ui/button";
import { CategoriaCard } from "@/components/catalogo/categoria-card";
import { NuevaCategoria } from "@/components/catalogo/nueva-categoria";
import { CatalogoTabs } from "@/components/catalogo/catalogo-tabs";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const [{ categorias, verificadas, totalCategorias }, pendientes] = await Promise.all([
    getMacroCategorias(),
    contarPendientes(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-3">
          <CatalogoTabs activa="categorias" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Categorías Macro</h1>
            <p className="text-sm text-muted-foreground">
              Catálogo de productos del depósito. Cada capa construye el SKU.
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <BadgeCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {verificadas.toLocaleString("es-AR")} de {totalCategorias.toLocaleString("es-AR")} categorías
              verificadas
            </p>
          </div>
        </div>
        <NuevaCategoria esMacro />
      </div>

      {pendientes > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm">
            <ListChecks className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Hay <span className="font-semibold tabular-nums">{pendientes.toLocaleString("es-AR")}</span>{" "}
              artículo{pendientes === 1 ? "" : "s"} pendiente{pendientes === 1 ? "" : "s"} de clasificar en{" "}
              <span className="font-mono">#REV</span>.
            </span>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/catalogo/clasificar" />} nativeButton={false}>
            Clasificar ahora <ArrowRight />
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categorias.map((c) => (
          <CategoriaCard
            key={c.id}
            categoria={{
              id: c.id,
              nombre: c.nombre,
              descripcion: c.descripcion,
              segmento: c.segmento,
              codigoSku: c.codigoSku,
              imagenUrl: c.imagenUrl,
              childrenCount: c._count.children,
              productosCount: c._count.productos,
              parentSku: null,
              verificacion: c.verificacion,
            }}
          />
        ))}
        <NuevaCategoria esMacro tile />
      </div>
    </main>
  );
}
