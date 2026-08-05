"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductoDetalleDialog } from "@/components/teamplace/producto-detalle-dialog";

import type { TeamplaceProductoResumen } from "@/lib/teamplace";

// Alias del tipo canónico de src/lib/teamplace.ts (antes estaba duplicado acá).
export type ProductoResumen = TeamplaceProductoResumen;

const PAGE_SIZE = 50;

export function ProductosTable({ productos }: { productos: ProductoResumen[] }) {
  const [q, setQ] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [page, setPage] = useState(0);
  const [detalle, setDetalle] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return productos.filter((p) => {
      if (soloActivos && !p.activo) return false;
      if (!term) return true;
      return (
        p.codigo.toLowerCase().includes(term) ||
        p.nombre.toLowerCase().includes(term) ||
        (p.descripcion ?? "").toLowerCase().includes(term)
      );
    });
  }, [productos, q, soloActivos]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const visibles = filtrados.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por código, nombre o descripción…"
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => {
              setSoloActivos(e.target.checked);
              setPage(0);
            }}
          />
          Solo activos
        </label>
        <span className="text-sm text-muted-foreground">{filtrados.length} productos</span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24">Activo</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((p) => (
              <TableRow key={p.codigo}>
                <TableCell className="font-mono">{p.codigo}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {p.descripcion}
                </TableCell>
                <TableCell>
                  <Badge variant={p.activo ? "default" : "outline"}>
                    {p.activo ? "Sí" : "No"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="xs" variant="outline" onClick={() => setDetalle(p.codigo)}>
                    Ver todo
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {visibles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Página {pageSafe + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pageSafe === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pageSafe >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <ProductoDetalleDialog codigo={detalle} onOpenChange={(open) => !open && setDetalle(null)} />
    </div>
  );
}
