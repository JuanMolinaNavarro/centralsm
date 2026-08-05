import { getMacroCategorias } from "@/lib/catalogo";
import { CategoriaCard } from "@/components/catalogo/categoria-card";
import { NuevaCategoria } from "@/components/catalogo/nueva-categoria";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const categorias = await getMacroCategorias();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías Macro</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de productos del depósito. Cada capa construye el SKU.
          </p>
        </div>
        <NuevaCategoria esMacro />
      </div>

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
            }}
          />
        ))}
        <NuevaCategoria esMacro tile />
      </div>
    </main>
  );
}
