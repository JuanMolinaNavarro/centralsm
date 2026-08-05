import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fechaHoraAR } from "@/lib/fecha";

// Tabla de movimientos de stock (HistorialStock) compartida entre
// /dashboard/movimientos y /depositos/[id] (antes estaba copiada en ambas).
// `conDeposito` agrega la columna Depósito (en la página de un depósito sobra).

type Mov = {
  id: string;
  fecha: Date;
  antes: { toString(): string };
  ahora: { toString(): string };
  delta: { toString(): string };
  producto: { id: string; codigoSku: string; nombre: string };
  deposito?: { id: string; nombre: string };
};

const nf = (n: number) => n.toLocaleString("es-AR");

export function MovimientosTable({
  movimientos,
  conDeposito = false,
}: {
  movimientos: Mov[];
  conDeposito?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Fecha</TableHead>
            <TableHead className="w-32">Código</TableHead>
            <TableHead>Producto</TableHead>
            {conDeposito && <TableHead>Depósito</TableHead>}
            <TableHead className="w-20 text-right">Antes</TableHead>
            <TableHead className="w-20 text-right">Ahora</TableHead>
            <TableHead className="w-24 text-right">Δ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movimientos.map((m) => {
            const delta = Number(m.delta.toString());
            const sube = delta > 0;
            return (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fechaHoraAR(m.fecha)}
                </TableCell>
                <TableCell className="font-mono">{m.producto.codigoSku}</TableCell>
                <TableCell>
                  <Link href={`/catalogo/articulo/${m.producto.id}`} className="hover:underline">
                    {m.producto.nombre}
                  </Link>
                </TableCell>
                {conDeposito && m.deposito && (
                  <TableCell>
                    <Link
                      href={`/depositos/${m.deposito.id}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {m.deposito.nombre}
                    </Link>
                  </TableCell>
                )}
                <TableCell className="text-right font-mono text-muted-foreground">
                  {nf(Number(m.antes.toString()))}
                </TableCell>
                <TableCell className="text-right font-mono">{nf(Number(m.ahora.toString()))}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 font-mono font-semibold ${sube ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {sube ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                    {sube ? "+" : "−"}
                    {nf(Math.abs(delta))}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
