"use client";

// Pestaña 2 · Movimientos — crece sola con la operación. Solo las filas de
// tipo Consumo entran en la serie de demanda; el tipo de movimiento es el
// campo que no existe en Finnegans y el que mantiene limpio el cálculo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  eliminarMovimiento,
  guardarMovimiento,
  type MovimientoInput,
} from "@/app/catalogo/articulo/[id]/ficha/actions";
import type { FichaData } from "@/lib/ficha-data";
import type { MovimientoFicha } from "@/lib/ficha";
import { EXPL_DEMANDA, EXPL_MOVIMIENTO, nf, TIPO_DEMANDA, TIPO_MOVIMIENTO } from "./constantes";
import { GraficoSerie } from "./graficos";
import { InfoDialog, InfoFila, InfoItem } from "./info-dialog";

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const VACIO: MovimientoInput = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "CONSUMO",
  demanda: "RECURRENTE",
  solicitado: 0,
  entregado: 0,
  destino: "",
  pedido: "",
};

function estadoEntrega(m: MovimientoFicha): "pendiente" | "parcial" | null {
  if (m.solicitado > 0 && m.entregado === 0) return "pendiente";
  if (m.entregado > 0 && m.entregado < m.solicitado) return "parcial";
  return null;
}

export function MovimientosPanel({ data }: { data: FichaData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const productoId = data.producto.id;

  const [abierto, setAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [f, setF] = useState<MovimientoInput>(VACIO);

  const consumos = data.movimientos.filter((m) => m.tipo === "CONSUMO").length;
  const mesesConDemanda = data.serie.filter((x) => x > 0).length;
  // Con el kardex importado un artículo puede tener miles de filas: se muestran
  // las más recientes (el cálculo usa todas las de la ventana igual).
  const MAX_VISIBLES = 150;
  const visibles = [...data.movimientos].reverse().slice(0, MAX_VISIBLES);

  function abrirNuevo() {
    setEditandoId(null);
    setF(VACIO);
    setAbierto(true);
  }
  function abrirEdicion(m: MovimientoFicha) {
    setEditandoId(m.id);
    setF({
      fecha: m.fecha,
      tipo: m.tipo,
      demanda: m.demanda,
      solicitado: m.solicitado,
      entregado: m.entregado,
      destino: m.destino ?? "",
      pedido: m.pedido ?? "",
    });
    setAbierto(true);
  }

  function guardar() {
    startTransition(async () => {
      const res = await guardarMovimiento(productoId, f, editandoId ?? undefined);
      if (res.ok) {
        toast.success(editandoId ? "Movimiento actualizado" : "Movimiento agregado");
        setAbierto(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" /> Agregar movimiento
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {data.movimientos.length} movimientos en la ventana · {consumos} cuentan como consumo ·{" "}
          {data.movimientos.length - consumos} excluidos
          {data.movimientos.length > MAX_VISIBLES && ` · se muestran los ${MAX_VISIBLES} más recientes`}
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>
                <span className="inline-flex items-center">
                  Tipo de movimiento
                  <InfoDialog
                    titulo="Tipo de movimiento · qué significa cada uno"
                    intro="Todos mueven stock, pero solo uno es demanda. Elegir bien el tipo es lo que mantiene limpio el cálculo de la pestaña Derivado."
                  >
                    {EXPL_MOVIMIENTO.map((e) => (
                      <InfoItem key={e.tipo} titulo={TIPO_MOVIMIENTO[e.tipo]}>
                        <InfoFila etiqueta="¿Qué es?">{e.queEs}</InfoFila>
                        <InfoFila etiqueta="Efecto en el cálculo" tono="verde">{e.efecto}</InfoFila>
                        <InfoFila etiqueta="Ejemplo" tono="rojo">{e.ejemplo}</InfoFila>
                      </InfoItem>
                    ))}
                  </InfoDialog>
                </span>
              </TableHead>
              <TableHead>
                <span className="inline-flex items-center">
                  Demanda
                  <InfoDialog
                    titulo="Tipo de demanda · qué significa cada uno"
                    intro="Solo aplica a los movimientos de tipo Consumo. Separa la demanda que sirve para pronosticar de la que la distorsiona."
                  >
                    {EXPL_DEMANDA.map((e) => (
                      <InfoItem key={e.tipo} titulo={TIPO_DEMANDA[e.tipo]}>
                        <InfoFila etiqueta="¿Qué es?">{e.queEs}</InfoFila>
                        {e.paraQue && <InfoFila etiqueta="¿Para qué sirve?" tono="verde">{e.paraQue}</InfoFila>}
                      </InfoItem>
                    ))}
                  </InfoDialog>
                </span>
              </TableHead>
              <TableHead className="text-right">Solicitado [{data.producto.unidadBase}]</TableHead>
              <TableHead className="text-right">Entregado [{data.producto.unidadBase}]</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>
                <span className="inline-flex items-center">
                  Pedido
                  <InfoDialog
                    titulo="Pedido · para qué sirve"
                    intro="Es la trazabilidad de la fila: el documento que originó el movimiento."
                  >
                    <InfoItem titulo="N° de pedido / vale / remito">
                      <InfoFila etiqueta="¿Qué es?">
                        El N° del pedido de sucursal, orden de compra, remito o vale que hizo que este stock se moviera.
                      </InfoFila>
                      <InfoFila etiqueta="¿Para qué sirve?" tono="verde">
                        Responde «¿por qué salió esto?» sin buscar en papeles, y empareja las salidas a proyecto con
                        sus reingresos por el mismo N° de vale.
                      </InfoFila>
                      <InfoFila etiqueta="A futuro" tono="rojo">
                        Cuando el circuito de pedidos esté vivo, este campo se completará solo: cada entrega nacerá de
                        un pedido y la fila heredará su número.
                      </InfoFila>
                    </InfoItem>
                  </InfoDialog>
                </span>
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.movimientos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Sin movimientos cargados. Los movimientos de tipo Consumo alimentan toda la pestaña Derivado.
                </TableCell>
              </TableRow>
            )}
            {visibles.map((m) => {
              const excluida = m.tipo !== "CONSUMO";
              const estado = estadoEntrega(m);
              return (
                <TableRow
                  key={m.id}
                  className={
                    estado === "pendiente"
                      ? "bg-orange-500/10"
                      : estado === "parcial"
                        ? "bg-yellow-500/10"
                        : undefined
                  }
                >
                  <TableCell className={`font-mono text-xs ${excluida ? "opacity-50" : ""}`}>{m.fecha}</TableCell>
                  <TableCell className={excluida ? "opacity-50" : ""}>
                    <Badge variant={excluida ? "outline" : "default"}>{TIPO_MOVIMIENTO[m.tipo]}</Badge>
                  </TableCell>
                  <TableCell className={`text-muted-foreground ${excluida ? "opacity-50" : ""}`}>
                    {TIPO_DEMANDA[m.demanda]}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${excluida ? "opacity-50" : ""}`}>
                    {nf(m.solicitado)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${excluida ? "opacity-50" : ""}`}>
                    {nf(m.entregado)}
                  </TableCell>
                  <TableCell className={excluida ? "opacity-50" : ""}>
                    <div>{m.destino ?? "—"}</div>
                    {m.deposito && m.deposito !== m.destino && (
                      <div className="text-xs text-muted-foreground">{m.deposito}</div>
                    )}
                  </TableCell>
                  <TableCell className={`font-mono text-xs ${excluida ? "opacity-50" : ""}`}>
                    {m.pedido ?? m.documento ?? "—"}
                    {m.fuente === "KARDEX" && (
                      <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">ERP</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => abrirEdicion(m)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar"
                        disabled={pending}
                        onClick={() => {
                          if (confirm("¿Eliminar este movimiento?")) {
                            startTransition(async () => {
                              const res = await eliminarMovimiento(productoId, m.id);
                              if (res.ok) router.refresh();
                              else toast.error(res.error);
                            });
                          }
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-sm bg-orange-500/60" /> Pendiente de entrega
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-sm bg-yellow-500/60" /> Entrega parcial
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-sm bg-muted-foreground/40" /> Atenuado: no cuenta como consumo
        </span>
      </div>

      {/* En calle */}
      {data.vales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-orange-600 dark:text-orange-400">
              En calle · salidas a proyectos eventuales
            </CardTitle>
            <CardDescription>
              Cada vale enlaza la salida con su reingreso por el mismo N° en la columna Pedido. Lo que salió y
              no volvió sigue siendo stock de la empresa pero está fuera del depósito: no es consumo y no
              infla la demanda.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {data.vales.map((v) => (
              <div key={v.pedido} className="flex flex-wrap items-baseline gap-4 py-2 text-sm">
                <span className="font-mono font-semibold text-primary">{v.pedido}</span>
                {v.destino && <span>{v.destino}</span>}
                <span>salieron {nf(v.salida)}</span>
                <span>volvieron {nf(v.retorno)}</span>
                <span
                  className={`ml-auto font-mono ${
                    v.saldo > 0 ? "font-semibold text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {v.saldo > 0 ? `${nf(v.saldo)} sin devolver` : "vale cerrado"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Serie mensual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Serie mensual que alimenta el cálculo</CardTitle>
          <CardDescription>
            Se agregan por mes solo los movimientos de tipo Consumo. {mesesConDemanda} de {data.serie.length}{" "}
            meses con demanda.
            {data.consumosPredecesor > 0 &&
              ` Incluye ${data.consumosPredecesor} consumos empalmados del predecesor ${data.producto.predecesor?.codigoSku}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoSerie meses={data.meses} serie={data.serie} />
        </CardContent>
      </Card>

      <div className="rounded-lg border-l-2 border-orange-500 bg-orange-500/5 px-4 py-3 text-sm text-muted-foreground">
        <b className="text-foreground">Por qué importa el tipo de movimiento.</b> Solo las filas marcadas como{" "}
        <i>Consumo</i> entran en la serie. Una transferencia entre depósitos o una devolución mueven stock
        pero no son demanda, y si se cuentan inflan el promedio y arruinan la clasificación. Este es el campo
        que hoy no existe en Finnegans.
      </div>

      {/* Dialog alta/edición */}
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de movimiento</Label>
              <select
                className={selectCls}
                value={f.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as MovimientoInput["tipo"];
                  setF({ ...f, tipo, demanda: tipo === "CONSUMO" ? (f.demanda === "NA" ? "RECURRENTE" : f.demanda) : "NA" });
                }}
              >
                {Object.entries(TIPO_MOVIMIENTO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de demanda</Label>
              <select
                className={selectCls}
                value={f.demanda}
                disabled={f.tipo !== "CONSUMO"}
                onChange={(e) => setF({ ...f, demanda: e.target.value as MovimientoInput["demanda"] })}
              >
                {Object.entries(TIPO_DEMANDA).map(([k, v]) => (
                  <option key={k} value={k} disabled={k === "NA" && f.tipo === "CONSUMO"}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Destino</Label>
              <Input
                value={f.destino ?? ""}
                onChange={(e) => setF({ ...f, destino: e.target.value })}
                placeholder="Sucursales, Obra, Depósito Salta…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Solicitado [{data.producto.unidadBase}]</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={String(f.solicitado)}
                onChange={(e) => setF({ ...f, solicitado: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Entregado [{data.producto.unidadBase}]</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={String(f.entregado)}
                onChange={(e) => setF({ ...f, entregado: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Pedido / vale</Label>
              <Input
                value={f.pedido ?? ""}
                onChange={(e) => setF({ ...f, pedido: e.target.value })}
                placeholder="PED-1234 · VAL-0032"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
