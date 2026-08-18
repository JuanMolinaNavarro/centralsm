import { Suspense } from "react";
import { CatalogoTabs } from "@/components/catalogo/catalogo-tabs";
import { Clasificador, type FiltroUI } from "@/components/catalogo/clasificador";
import {
  buscarArticulosParaClasificar,
  contarPendientes,
  getCategoriasPlanas,
} from "@/lib/catalogo";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function uno(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ClasificarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ordenRaw = uno(sp.orden);
  const filtro: FiltroUI = {
    q: uno(sp.q),
    cat: uno(sp.cat) || "pendientes",
    soloStock: uno(sp.stock) === "1",
    orden: ordenRaw === "stock" || ordenRaw === "reciente" ? ordenRaw : "nombre",
  };
  const pagina = Number.parseInt(uno(sp.pagina), 10) || 1;

  const categorias = await getCategoriasPlanas();
  const [resultado, pendientes] = await Promise.all([
    buscarArticulosParaClasificar({ ...filtro, pagina }, categorias),
    contarPendientes(categorias),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-6 flex flex-col gap-3">
        <CatalogoTabs activa="clasificar" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clasificar artículos</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Buscá, seleccioná varios (clic en la fila, <kbd className="rounded border px-1 font-mono text-xs">Shift</kbd>{" "}
            + clic para rangos) y movelos a su categoría con «Mover a…». Los que el sync no pudo
            clasificar quedan en <span className="font-mono">#REV</span> y aparecen acá por defecto.
          </p>
        </div>
      </div>

      <Suspense>
        <Clasificador
          items={resultado.items}
          total={resultado.total}
          pagina={resultado.pagina}
          paginas={resultado.paginas}
          tamano={resultado.tamano}
          filtro={filtro}
          categorias={categorias}
          pendientes={pendientes}
        />
      </Suspense>
    </main>
  );
}
