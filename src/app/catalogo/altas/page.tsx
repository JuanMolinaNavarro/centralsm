import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductosConPush } from "@/lib/productos";
import { fechaHoraAR } from "@/lib/fecha";
import { ReintentarPush } from "@/components/productos/reintentar-push";
import { CatalogoTabs } from "@/components/catalogo/catalogo-tabs";

export const dynamic = "force-dynamic";

const VARIANTE = {
  PENDIENTE: "secondary",
  EN_PROCESO: "secondary",
  SINCRONIZADO: "default",
  ERROR: "destructive",
  NO_APLICA: "outline",
} as const;

const ETIQUETA = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "Cargando…",
  SINCRONIZADO: "En Finnegans",
  ERROR: "Error",
  NO_APLICA: "—",
} as const;

export default async function ProductosPage() {
  const productos = await getProductosConPush();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <CatalogoTabs activa="altas" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Altas Finnegans</h1>
            <p className="text-sm text-muted-foreground">
              Altas hechas desde CentralSM y su estado de carga en Finnegans Go.
            </p>
          </div>
        </div>
        <Button render={<Link href="/catalogo/altas/nuevo" />} nativeButton={false}>
          Nuevo producto
        </Button>
      </div>

      <div className="mt-8 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código Finnegans</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>SKU CentralSM</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Todavía no cargaste productos desde CentralSM.
                </TableCell>
              </TableRow>
            )}
            {productos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.teamplaceCodigo}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {p.codigoSku}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={VARIANTE[p.finnegansPushEstado]}>
                      {ETIQUETA[p.finnegansPushEstado]}
                    </Badge>
                    {p.finnegansPushError && (
                      <span className="max-w-xs text-xs text-muted-foreground">
                        {p.finnegansPushError}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fechaHoraAR(p.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  {p.finnegansPushEstado === "ERROR" && <ReintentarPush productoId={p.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
