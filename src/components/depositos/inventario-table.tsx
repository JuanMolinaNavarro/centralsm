"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InventarioItem = {
  productoId: string;
  codigoSku: string;
  nombre: string;
  unidadStock: string;
  cantidad: number;
};

export function InventarioTable({ items }: { items: InventarioItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (i) => i.nombre.toLowerCase().includes(t) || i.codigoSku.toLowerCase().includes(t),
    );
  }, [items, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto por código o nombre…"
            className="pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtrados.length} productos</span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="w-32 text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((i) => (
              <TableRow
                key={i.productoId}
                className="cursor-pointer"
                onClick={() => router.push(`/catalogo/articulo/${i.productoId}`)}
              >
                <TableCell className="font-mono">{i.codigoSku}</TableCell>
                <TableCell>{i.nombre}</TableCell>
                <TableCell className="text-right font-mono">
                  {i.cantidad.toLocaleString("es-AR")} {i.unidadStock}
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
