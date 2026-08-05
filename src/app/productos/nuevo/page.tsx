import Link from "next/link";
import { getCategoriasParaSelect } from "@/lib/productos";
import { ProductoFinnegansForm } from "@/components/productos/producto-finnegans-form";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const categorias = await getCategoriasParaSelect();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-1">
        <Link href="/productos" className="w-fit text-sm text-muted-foreground hover:underline">
          ← Productos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Los campos son los mismos del alta de Finnegans Go. Al guardar, se crea en CentralSM y un
          bot de Playwright lo carga automáticamente en Finnegans Go.
        </p>
      </div>

      <div className="mt-8">
        <ProductoFinnegansForm categorias={categorias} />
      </div>
    </main>
  );
}
