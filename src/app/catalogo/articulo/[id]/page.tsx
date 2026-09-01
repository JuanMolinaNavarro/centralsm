import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProducto,
  getBreadcrumbs,
  getStockProducto,
  getCaracteristicasFicha,
} from "@/lib/catalogo";
import { fechaHoraAR, fechaHoraLargaAR } from "@/lib/fecha";
import { Breadcrumbs } from "@/components/catalogo/breadcrumbs";
import { ArticuloDetailActions } from "@/components/catalogo/articulo-detail-actions";
import { CaracteristicasArticulo } from "@/components/catalogo/caracteristicas-articulo";

export const dynamic = "force-dynamic";

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <span className="w-48 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default async function ArticuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const producto = await getProducto(id);
  if (!producto) notFound();

  const crumbs = await getBreadcrumbs(producto.categoriaId);
  const cantidad = Number(producto.cantidadStock.toString());

  const [stock, caracteristicas] = await Promise.all([
    getStockProducto(id),
    getCaracteristicasFicha(id),
  ]);
  const stockTotal = stock.reduce((acc, s) => acc + Number(s.cantidad.toString()), 0);
  const snapshotAt = stock[0]?.snapshotAt ?? null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Breadcrumbs items={[...crumbs, { id: producto.id, nombre: producto.nombre, codigoSku: producto.codigoSku }]} />

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          {producto.imagenUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="size-24 rounded-lg border object-cover"
            />
          )}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{producto.nombre}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {producto.codigoSku}
              </Badge>
              <Badge variant={producto.estado === "ACTIVO" ? "default" : "outline"}>
                {producto.estado === "ACTIVO" ? "Activo" : "Inactivo"}
              </Badge>
              {producto.esNuevo && (
                <Badge className="gap-1">
                  <Sparkles className="size-3" /> Nuevo
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <ArticuloDetailActions
            categoriaSku={producto.categoria.codigoSku}
            producto={{
              id: producto.id,
              categoriaId: producto.categoriaId,
              nombre: producto.nombre,
              descripcion: producto.descripcion,
              estado: producto.estado,
              cantidadStock: cantidad,
              unidadStock: producto.unidadStock,
              lugar: producto.lugar,
              imagenUrl: producto.imagenUrl,
            }}
          />
          <Button
            render={<Link href={`/catalogo/articulo/${producto.id}/ficha`} />}
            nativeButton={false}
          >
            <ClipboardList className="size-4" /> Ficha operativa
          </Button>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="flex flex-col gap-4">
        <Prop label="Código">
          <span className="font-mono">{producto.codigoSku}</span>
        </Prop>
        <Prop label="Categoría">{producto.categoria.nombre}</Prop>
        <Prop label="Stock total">
          {cantidad.toLocaleString("es-AR")} {producto.unidadStock}
        </Prop>
        <Prop label="Lugar">{producto.lugar ?? "—"}</Prop>
        <Prop label="Estado">{producto.estado === "ACTIVO" ? "Activo" : "Inactivo"}</Prop>
        <Prop label="Creado">{fechaHoraLargaAR(producto.createdAt)}</Prop>
        {producto.descripcion && <Prop label="Descripción">{producto.descripcion}</Prop>}
      </div>

      <Separator className="my-8" />

      <CaracteristicasArticulo
        productoId={producto.id}
        categoriaId={producto.categoriaId}
        caracteristicas={caracteristicas}
      />

      <Separator className="my-8" />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Stock en depósitos</h2>
          {snapshotAt && (
            <span className="text-xs text-muted-foreground">
              snapshot de Teamplace al {fechaHoraAR(snapshotAt)}
            </span>
          )}
        </div>

        {stock.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin stock cacheado para este artículo. Actualizá el snapshot con{" "}
            <code className="font-mono">npm run teamplace:stock-pull</code>.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{stockTotal.toLocaleString("es-AR")}</span>{" "}
              {producto.unidadStock} · en {stock.length} depósito{stock.length === 1 ? "" : "s"}
            </p>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Depósito</TableHead>
                    <TableHead className="w-28 text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.deposito.nombre}</TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(s.cantidad.toString()).toLocaleString("es-AR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Proviene del último snapshot de Teamplace (no es tiempo real). Se actualiza al inicio de cada día.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
