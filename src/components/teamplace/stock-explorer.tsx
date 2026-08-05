"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Fila = Record<string, unknown>;

function columnasDe(filas: Fila[]): string[] {
  const cols: string[] = [];
  for (const fila of filas) {
    for (const k of Object.keys(fila)) {
      if (!cols.includes(k)) cols.push(k);
    }
  }
  return cols;
}

function celda(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export function StockExplorer() {
  const [moneda, setMoneda] = useState("PES");
  const [producto, setProducto] = useState("");
  const [deposito, setDeposito] = useState("");
  const [soloNoCero, setSoloNoCero] = useState(true);

  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function ejecutar() {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ MonedaID: moneda || "PES" });
      if (producto.trim()) qs.set("producto", producto.trim());
      if (deposito.trim()) qs.set("deposito", deposito.trim());
      if (soloNoCero) qs.set("soloStockNoCero", "true");

      const res = await fetch(`/api/teamplace/stock?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al consultar el stock.");
      const arr: Fila[] = Array.isArray(json) ? json : [];
      setFilas(arr);
      if (arr.length === 0) toast.info("Sin resultados para esos filtros.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el stock.");
    } finally {
      setLoading(false);
    }
  }

  const columnas = filas ? columnasDe(filas) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <p className="text-muted-foreground">
          El stock se obtiene con un <strong>reporte de Teamplace, que tiene costo</strong>. Se
          factura <strong>por consulta</strong> (no por cantidad de filas). La pantalla solo llama a
          la API cuando confirmás <strong>Consultar</strong>.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stk-moneda">Moneda *</Label>
          <Input
            id="stk-moneda"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            placeholder="PES"
            className="w-28"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stk-producto">Producto (código)</Label>
          <Input
            id="stk-producto"
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            placeholder="Opcional"
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stk-deposito">Depósito (código)</Label>
          <Input
            id="stk-deposito"
            value={deposito}
            onChange={(e) => setDeposito(e.target.value)}
            placeholder="Opcional"
            className="w-40"
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloNoCero}
            onChange={(e) => setSoloNoCero(e.target.checked)}
          />
          Solo stock ≠ 0
        </label>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Consultar
        </Button>
      </form>

      {filas && (
        <>
          <span className="text-sm text-muted-foreground">
            {filas.length} filas · {columnas.length} columnas
          </span>
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnas.map((c) => (
                    <TableHead key={c} className="whitespace-nowrap">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila, i) => (
                  <TableRow key={i}>
                    {columnas.map((c) => (
                      <TableCell key={c} className="whitespace-nowrap">
                        {celda(fila[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!filas && !loading && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ingresá los filtros y tocá <strong>Consultar</strong> para ver el stock. La moneda es
          obligatoria (ej. PES).
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esta consulta tiene costo</DialogTitle>
            <DialogDescription>
              Consultar el stock ejecuta un reporte de Teamplace, que es un consumo facturable (una
              vez por consulta, sin importar cuántas filas devuelva). ¿Querés continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={ejecutar}>Consultar de todas formas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
