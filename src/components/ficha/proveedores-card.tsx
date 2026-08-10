"use client";

// Medida y Valor: cada proveedor puede mandar el mismo artículo en
// presentaciones distintas. La selección queda guardada y es la que usa el
// cálculo de la pestaña Derivado (lote mínimo, múltiplo y último precio).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  agregarPrecio,
  eliminarPrecio,
  eliminarProveedor,
  guardarProveedor,
  seleccionarProveedor,
  type ProveedorInput,
} from "@/app/catalogo/articulo/[id]/ficha/actions";
import type { FichaData } from "@/lib/ficha-data";
import { nf } from "./constantes";
import { GraficoPrecios } from "./graficos";

function CampoP({
  label,
  ayuda,
  children,
}: {
  label: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[11px] uppercase tracking-wide">{label}</Label>
      {children}
      {ayuda && <p className="text-xs leading-snug text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

const VACIO: ProveedorInput = {
  nombre: "",
  unidadCompra: "unidad",
  factorCompra: 1,
  unidadConsumo: "unidad",
  factorConsumo: 1,
  loteMinimo: 0,
  multiplo: 1,
};

export function ProveedoresCard({ data }: { data: FichaData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const productoId = data.producto.id;

  // Proveedor visible en la tarjeta (por defecto, el seleccionado del cálculo).
  const [visibleId, setVisibleId] = useState<string | "nuevo" | null>(
    data.seleccionado?.id ?? (data.proveedores[0]?.id ?? "nuevo"),
  );
  const visible = data.proveedores.find((x) => x.id === visibleId) ?? null;

  const [form, setForm] = useState<ProveedorInput>(visible ?? VACIO);
  const [nuevoPrecio, setNuevoPrecio] = useState({ fecha: "", precioUsd: "" });

  function verProveedor(id: string | "nuevo") {
    setVisibleId(id);
    const p = data.proveedores.find((x) => x.id === id);
    setForm(
      p
        ? {
            nombre: p.nombre,
            unidadCompra: p.unidadCompra,
            factorCompra: p.factorCompra,
            unidadConsumo: p.unidadConsumo,
            factorConsumo: p.factorConsumo,
            loteMinimo: p.loteMinimo,
            multiplo: p.multiplo,
          }
        : VACIO,
    );
  }

  const accion = (fn: () => Promise<{ ok: boolean } & { error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error");
      }
    });

  const esSeleccionado = visible?.id === data.producto.proveedorSeleccionadoId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-primary">Medida y valor</CardTitle>
        <CardDescription>
          Condiciones impuestas por el proveedor: presentación, lote y precio. Cada proveedor se carga por
          separado y la <b>selección</b> es la que alimenta el cálculo de la pestaña Derivado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Pestañas de proveedores */}
        <div className="flex flex-wrap items-center gap-2">
          {data.proveedores.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => verProveedor(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                p.id === visibleId
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {p.nombre}
              {p.id === data.producto.proveedorSeleccionadoId && <Check className="size-3.5" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => verProveedor("nuevo")}
            className={`inline-flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-sm ${
              visibleId === "nuevo" ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="size-3.5" /> Proveedor
          </button>
          {data.proveedores.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              ✓ = usado por el cálculo
            </span>
          )}
        </div>

        {/* Form del proveedor visible */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CampoP label="Proveedor / presentación">
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: FiberNac SRL · nacional"
            />
          </CampoP>
          <CampoP label="Unidad de compra mínima" ayuda="Cómo lo vende: caja, bolsa, bobina.">
            <Input value={form.unidadCompra} onChange={(e) => setForm({ ...form, unidadCompra: e.target.value })} />
          </CampoP>
          <CampoP
            label="Factor de compra"
            ayuda="Comprás 1 unidad de compra y entran al stock esta cantidad de unidades base. Caja x 100 → 100."
          >
            <Input
              type="number"
              min="0"
              step="any"
              value={String(form.factorCompra)}
              onChange={(e) => setForm({ ...form, factorCompra: Number(e.target.value) })}
            />
          </CampoP>
          <CampoP label="Unidad de consumo interno" ayuda="Cómo sale del depósito hacia la operación.">
            <Input value={form.unidadConsumo} onChange={(e) => setForm({ ...form, unidadConsumo: e.target.value })} />
          </CampoP>
          <CampoP label="Factor de consumo" ayuda="Entregás 1 unidad de consumo y salen del stock esta cantidad de unidades base.">
            <Input
              type="number"
              min="0"
              step="any"
              value={String(form.factorConsumo)}
              onChange={(e) => setForm({ ...form, factorConsumo: Number(e.target.value) })}
            />
          </CampoP>
          <CampoP
            label="Lote mínimo (unidad base)"
            ayuda={
              form.factorCompra
                ? `= ${nf(Number(form.loteMinimo) / Number(form.factorCompra), 1)} unidades de compra (${form.unidadCompra}). Si cambia la presentación, cambia el lote.`
                : "Cargá el factor de compra para ver la equivalencia."
            }
          >
            <Input
              type="number"
              min="0"
              step="any"
              value={String(form.loteMinimo)}
              onChange={(e) => setForm({ ...form, loteMinimo: Number(e.target.value) })}
            />
          </CampoP>
          <CampoP label="Múltiplo de compra" ayuda="El escalón por encima del mínimo.">
            <Input
              type="number"
              min="0"
              step="any"
              value={String(form.multiplo)}
              onChange={(e) => setForm({ ...form, multiplo: Number(e.target.value) })}
            />
          </CampoP>
          <div className="flex items-end gap-2">
            <Button
              onClick={() =>
                accion(
                  () => guardarProveedor(productoId, form, visible?.id),
                  visible ? "Proveedor actualizado" : "Proveedor creado",
                )
              }
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {visible ? "Guardar proveedor" : "Crear proveedor"}
            </Button>
            {visible && !esSeleccionado && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => accion(() => seleccionarProveedor(productoId, visible.id), "Proveedor seleccionado para el cálculo")}
              >
                Usar en el cálculo
              </Button>
            )}
            {visible && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar proveedor"
                disabled={pending}
                onClick={() => {
                  if (confirm(`¿Eliminar el proveedor "${visible.nombre}" y sus precios?`)) {
                    accion(() => eliminarProveedor(productoId, visible.id), "Proveedor eliminado");
                    setVisibleId(null);
                  }
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {/* Precios del proveedor visible */}
        {visible && (
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium">
                Precios de {visible.nombre}{" "}
                <span className="text-xs text-muted-foreground">(USD por unidad base)</span>
              </h4>
              {esSeleccionado && data.costo !== null && (
                <Badge variant="secondary" className="font-mono">
                  costo vigente: {nf(data.costo, 2)} USD · {data.costoVigencia}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {visible.precios.map((pr) => (
                <span key={pr.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs">
                  {pr.fecha} · {nf(pr.precioUsd, 2)}
                  <button
                    type="button"
                    aria-label={`Eliminar precio del ${pr.fecha}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => accion(() => eliminarPrecio(productoId, pr.id), "Precio eliminado")}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {visible.precios.length === 0 && (
                <span className="text-xs text-muted-foreground">Sin precios cargados todavía.</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="font-mono text-[11px] uppercase">Fecha</Label>
                <Input
                  type="date"
                  className="w-40"
                  value={nuevoPrecio.fecha}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, fecha: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="font-mono text-[11px] uppercase">Precio USD</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="w-32"
                  value={nuevoPrecio.precioUsd}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioUsd: e.target.value })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || !nuevoPrecio.fecha || !nuevoPrecio.precioUsd}
                onClick={() =>
                  accion(async () => {
                    const res = await agregarPrecio(productoId, visible.id, {
                      fecha: nuevoPrecio.fecha,
                      precioUsd: Number(nuevoPrecio.precioUsd),
                    });
                    if (res.ok) setNuevoPrecio({ fecha: "", precioUsd: "" });
                    return res;
                  }, "Precio agregado")
                }
              >
                <Plus className="size-3.5" /> Agregar precio
              </Button>
              <p className="basis-full text-xs text-muted-foreground">
                Por unidad base: si la caja de 100 sale 152 USD, cargá 1,52.
              </p>
            </div>
          </div>
        )}

        {/* Evolución de precios */}
        <div>
          <h4 className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Evolución del precio
          </h4>
          <GraficoPrecios
            proveedores={data.proveedores}
            seleccionadoId={data.producto.proveedorSeleccionadoId}
            meses={data.meses}
            mesesISO={data.mesesISO}
          />
        </div>
      </CardContent>
    </Card>
  );
}
