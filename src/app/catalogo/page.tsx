import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ListChecks } from "lucide-react";
import {
  buscarArticulosPorTexto,
  contarPendientes,
  getCategoriasPlanas,
  getMacroCategorias,
} from "@/lib/catalogo";
import { Button } from "@/components/ui/button";
import { ArticuloCard } from "@/components/catalogo/articulo-card";
import { BuscadorCatalogo } from "@/components/catalogo/buscador-catalogo";
import { CategoriaCard } from "@/components/catalogo/categoria-card";
import { NuevaCategoria } from "@/components/catalogo/nueva-categoria";
import { CatalogoTabs } from "@/components/catalogo/catalogo-tabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function uno(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function CatalogoPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = uno(sp.q).trim();
  const pagina = Number.parseInt(uno(sp.pagina), 10) || 1;

  const [{ categorias, verificadas, totalCategorias }, pendientes] = await Promise.all([
    getMacroCategorias(),
    contarPendientes(),
  ]);

  // Con texto en el buscador, los resultados reemplazan al árbol de categorías.
  const busqueda = q ? await buscarArticulosPorTexto(q, { pagina }) : null;
  const rutas = busqueda
    ? new Map(
        (await getCategoriasPlanas()).map((c) => [c.id, [...c.ruta, c.nombre].join(" › ")]),
      )
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-3">
          <CatalogoTabs activa="categorias" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {busqueda ? "Búsqueda de artículos" : "Categorías Macro"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {busqueda
                ? "Buscá por SKU, nombre o características. Vaciá el buscador para volver al árbol."
                : "Catálogo de productos del depósito. Cada capa construye el SKU."}
            </p>
            {!busqueda && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <BadgeCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                {verificadas.toLocaleString("es-AR")} de {totalCategorias.toLocaleString("es-AR")}{" "}
                categorías verificadas
              </p>
            )}
          </div>
        </div>
        {!busqueda && <NuevaCategoria esMacro />}
      </div>

      <Suspense fallback={null}>
        <BuscadorCatalogo
          q={q}
          resultados={
            busqueda
              ? {
                  total: busqueda.total,
                  pagina: busqueda.pagina,
                  paginas: busqueda.paginas,
                  tamano: busqueda.tamano,
                  truncado: busqueda.truncado,
                }
              : null
          }
        >
          {busqueda && busqueda.items.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {busqueda.items.map((p) => (
                <ArticuloCard
                  key={p.id}
                  producto={{
                    id: p.id,
                    categoriaId: p.categoriaId,
                    categoriaSku: p.categoriaSku,
                    nombre: p.nombre,
                    descripcion: p.descripcion,
                    codigoSku: p.codigoSku,
                    estado: p.estado,
                    cantidadStock: p.cantidadStock,
                    unidadStock: p.unidadStock,
                    lugar: p.lugar,
                    imagenUrl: p.imagenUrl,
                    esNuevo: p.esNuevo,
                    rutaCategoria: rutas?.get(p.categoriaId) ?? p.categoriaNombre,
                    caracteristicas: p.caracteristicas,
                  }}
                />
              ))}
            </div>
          )}
        </BuscadorCatalogo>
      </Suspense>

      {!busqueda && pendientes > 0 && (
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

      {!busqueda && (
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
      )}
    </main>
  );
}
