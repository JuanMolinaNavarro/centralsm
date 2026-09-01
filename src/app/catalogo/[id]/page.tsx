import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCategoria, getBreadcrumbs } from "@/lib/catalogo";
import { Breadcrumbs } from "@/components/catalogo/breadcrumbs";
import { CategoriaCard } from "@/components/catalogo/categoria-card";
import { ArticuloCard } from "@/components/catalogo/articulo-card";
import { NuevaCategoria } from "@/components/catalogo/nueva-categoria";
import { NuevoArticulo } from "@/components/catalogo/nuevo-articulo";
import { VerificacionBadge } from "@/components/catalogo/verificacion-badge";
import { VerificarCategoriaButton } from "@/components/catalogo/verificar-categoria-button";

export const dynamic = "force-dynamic";

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const categoria = await getCategoria(id);
  if (!categoria) notFound();

  const crumbs = await getBreadcrumbs(id);

  const verificadaAt = categoria.verificacion.verificadaAt;
  const conStock = categoria.productos.filter((p) => Number(p.cantidadStock) > 0);
  const sinStock = categoria.productos.filter((p) => Number(p.cantidadStock) <= 0);

  const aCardData = (p: (typeof categoria.productos)[number]) => ({
    id: p.id,
    categoriaId: categoria.id,
    categoriaSku: categoria.codigoSku,
    nombre: p.nombre,
    descripcion: p.descripcion,
    codigoSku: p.codigoSku,
    estado: p.estado,
    cantidadStock: Number(p.cantidadStock.toString()),
    unidadStock: p.unidadStock,
    lugar: p.lugar,
    imagenUrl: p.imagenUrl,
    esNuevo: p.esNuevo,
    postVerificacion: !!verificadaAt && p.clasificadoAt > verificadaAt,
    caracteristicas: p.caracteristicas.map((c) => ({
      nombre: c.tipo.nombre,
      valor: c.valor,
      unidad: c.tipo.unidad,
    })),
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <Breadcrumbs items={crumbs} />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          {categoria.imagenUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={categoria.imagenUrl}
              alt={categoria.nombre}
              className="size-20 rounded-lg border object-cover"
            />
          )}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{categoria.nombre}</h1>
            {categoria.descripcion && (
              <p className="max-w-2xl text-sm text-muted-foreground">{categoria.descripcion}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="w-fit font-mono">
                {categoria.codigoSku}
              </Badge>
              <VerificacionBadge verificacion={categoria.verificacion} mostrarVacio />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <VerificarCategoriaButton
            categoriaId={categoria.id}
            categoriaNombre={categoria.nombre}
            verificacion={categoria.verificacion}
          />
          {categoria.productos.length > 0 && (
            <Button
              variant="outline"
              render={<Link href={`/catalogo/clasificar?cat=${categoria.id}`} />}
              nativeButton={false}
              title="Buscar, seleccionar y mover artículos de esta categoría"
            >
              <ArrowRightLeft className="size-4" /> Reclasificar
            </Button>
          )}
          <NuevaCategoria parentId={categoria.id} parentSku={categoria.codigoSku} />
          <NuevoArticulo categoriaId={categoria.id} categoriaSku={categoria.codigoSku} />
        </div>
      </div>

      <Separator className="my-8" />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium">Subcategorías</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoria.children.map((c) => (
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
                parentSku: categoria.codigoSku,
                verificacion: c.verificacion,
              }}
            />
          ))}
          <NuevaCategoria parentId={categoria.id} parentSku={categoria.codigoSku} tile />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Artículos con stock</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conStock.map((p) => (
            <ArticuloCard key={p.id} producto={aCardData(p)} />
          ))}
          <NuevoArticulo categoriaId={categoria.id} categoriaSku={categoria.codigoSku} tile />
        </div>
      </section>

      {sinStock.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-medium">Artículos sin stock</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sinStock.map((p) => (
              <ArticuloCard key={p.id} producto={aCardData(p)} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
