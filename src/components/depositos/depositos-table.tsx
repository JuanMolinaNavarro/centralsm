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

export type DepositoRow = {
  id: string;
  codigo: string;
  nombre: string;
  productos: number;
  totalUnidades: number;
};

export function DepositosTable({ depositos }: { depositos: DepositoRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return depositos;
    return depositos.filter(
      (d) => d.nombre.toLowerCase().includes(t) || d.codigo.toLowerCase().includes(t),
    );
  }, [depositos, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar depósito…"
            className="pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtrados.length} depósitos</span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Depósito</TableHead>
              <TableHead className="w-24">Código</TableHead>
              <TableHead className="w-28 text-right">Productos</TableHead>
              <TableHead className="w-36 text-right">Total unidades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer"
                onClick={() => router.push(`/depositos/${d.id}`)}
              >
                <TableCell className="font-medium">{d.nombre}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{d.codigo}</TableCell>
                <TableCell className="text-right">{d.productos.toLocaleString("es-AR")}</TableCell>
                <TableCell className="text-right font-mono">
                  {d.totalUnidades.toLocaleString("es-AR")}
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
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
