"use client";

// Pestaña 1 · Artículo — el maestro que se completa una vez y casi no cambia.
// Secciones: identidad, segmentación, restricción física y de compra.
// (Medida y Valor viven en proveedores-card.tsx porque dependen del proveedor.)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarMaestro, type MaestroInput } from "@/app/catalogo/articulo/[id]/ficha/actions";
import type { FichaData } from "@/lib/ficha-data";
import { EXPL_COSTO, TIPO_COSTO_LABEL } from "./constantes";

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Campo({
  label,
  ayuda,
  requerido,
  children,
}: {
  label: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-mono text-[11px] uppercase tracking-wide">
        {label}
        {requerido && <span className="text-destructive"> ·</span>}
      </Label>
      {children}
      {ayuda && <p className="text-xs leading-snug text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

export function MaestroForm({
  data,
  inactivos,
}: {
  data: FichaData;
  inactivos: { id: string; codigoSku: string; nombre: string }[];
}) {
  const p = data.producto;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [f, setF] = useState({
    unidadBase: p.unidadBase,
    entidades: p.entidades ?? "",
    criticidad: p.criticidad ? String(p.criticidad) : "",
    kitNombre: p.kitNombre ?? "",
    kitCantidad: p.kitCantidad != null ? String(p.kitCantidad) : "",
    predecesorId: p.predecesorId ?? "",
    sustitutos: p.sustitutos ?? "",
    origen: p.origen ?? "",
    estadoItem: p.estadoItem,
    tipoCosto: p.tipoCosto,
    volumen: String(p.volumen),
    peso: String(p.peso),
    requiereAutoelevador: p.requiereAutoelevador,
    vidaUtilMeses: p.vidaUtilMeses != null ? String(p.vidaUtilMeses) : "",
    enTransito: String(p.enTransito),
    instalacionesMes: p.instalacionesMes != null ? String(p.instalacionesMes) : "",
  });

  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const numONull = (s: string) => (s.trim() === "" ? null : Number(s));

  function guardar() {
    const input: MaestroInput = {
      unidadBase: f.unidadBase,
      entidades: f.entidades || null,
      criticidad: numONull(f.criticidad),
      kitNombre: f.kitNombre || null,
      kitCantidad: numONull(f.kitCantidad),
      predecesorId: f.predecesorId || null,
      sustitutos: f.sustitutos || null,
      origen: (f.origen || null) as MaestroInput["origen"],
      estadoItem: f.estadoItem,
      tipoCosto: f.tipoCosto,
      volumen: Number(f.volumen) || 0,
      peso: Number(f.peso) || 0,
      requiereAutoelevador: f.requiereAutoelevador,
      vidaUtilMeses: numONull(f.vidaUtilMeses),
      enTransito: Number(f.enTransito) || 0,
      instalacionesMes: numONull(f.instalacionesMes),
    };
    startTransition(async () => {
      const res = await guardarMaestro(p.id, input);
      if (res.ok) {
        toast.success("Ficha guardada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Identidad y agregación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-primary">
            Identidad y agregación
          </CardTitle>
          <CardDescription>Se completa una única vez. Define en qué parte del catálogo entra.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="SKU interno" requerido ayuda="Clave de los cuatro niveles.">
            <Input value={p.codigoSku} disabled className="font-mono" />
          </Campo>
          <Campo label="Grupo · nivel 3" requerido>
            <Input value={p.categoria.nombre} disabled />
            <span className="font-mono text-xs text-primary">{p.categoria.codigoSku}</span>
          </Campo>
          <Campo label="Estado" requerido>
            <Input value={p.estado === "ACTIVO" ? "activo" : "inactivo"} disabled />
          </Campo>
          <Campo label="Entidades habilitadas">
            <select className={selectCls} value={f.entidades} onChange={(e) => set("entidades")(e.target.value)}>
              <option value="">—</option>
              {["Providers", "Multimedios", "Tecnovus"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Campo>
        </CardContent>
      </Card>

      {/* Segmentación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-primary">Segmentación</CardTitle>
          <CardDescription>
            Define la lógica que sigue el artículo. Criticidad es el único dato deducible subjetivamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Criticidad operativa" requerido ayuda="1 frena el servicio · 2 retrasa · 3 no afecta.">
            <select className={selectCls} value={f.criticidad} onChange={(e) => set("criticidad")(e.target.value)}>
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </Campo>
          <Campo
            label="Kit al que pertenece"
            ayuda="Si el artículo se usa dentro de un kit (ej. Instalación FTTH), su consumo no se pronostica: es demanda derivada, depende de cuántos trabajos se hagan."
          >
            <Input value={f.kitNombre} onChange={(e) => set("kitNombre")(e.target.value)} placeholder="Ej: Instalación FTTH" />
          </Campo>
          <Campo label="Cantidad mínima por kit" ayuda="Cuántas unidades como mínimo consume cada trabajo.">
            <Input type="number" min="0" step="any" value={f.kitCantidad} onChange={(e) => set("kitCantidad")(e.target.value)} />
          </Campo>
          <Campo
            label="Artículo predecesor"
            ayuda="Artículo inactivo que este reemplaza: las series de consumo se empalman para no perder la historia."
          >
            <select className={selectCls} value={f.predecesorId} onChange={(e) => set("predecesorId")(e.target.value)}>
              <option value="">—</option>
              {inactivos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.codigoSku} · {i.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Sustitutos funcionales" ayuda="Intercambiables sin cambiar el servicio.">
            <Input value={f.sustitutos} onChange={(e) => set("sustitutos")(e.target.value)} />
          </Campo>
          <Campo label="Origen" requerido ayuda="Atributo, no artículo distinto. Cambia el lead time.">
            <select className={selectCls} value={f.origen} onChange={(e) => set("origen")(e.target.value)}>
              <option value="">—</option>
              <option value="NACIONAL">nacional</option>
              <option value="IMPORTADO">importado</option>
            </select>
          </Campo>
          <Campo label="Estado del ítem" requerido ayuda="Un recorte es el mismo artículo en otro estado.">
            <select className={selectCls} value={f.estadoItem} onChange={(e) => set("estadoItem")(e.target.value)}>
              <option value="NUEVO">nuevo</option>
              <option value="RECORTE">recorte</option>
              <option value="RECUPERADO">recuperado</option>
            </select>
          </Campo>
          <Campo label="Tipo de costo" requerido ayuda={EXPL_COSTO[f.tipoCosto]}>
            <select className={selectCls} value={f.tipoCosto} onChange={(e) => set("tipoCosto")(e.target.value)}>
              {Object.entries(TIPO_COSTO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Campo>
        </CardContent>
      </Card>

      {/* Restricción física y de compra */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-primary">
            Restricción física y de compra
          </CardTitle>
          <CardDescription>
            El artículo como objeto físico y lo que hay en juego para reponerlo: cuánto ocupa y pesa —para
            decidir dónde va en el depósito— y el stock comprometido, para que la sugerencia de compra no
            compre dos veces.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Unidad base" requerido ayuda="La unidad en la que se cuenta el stock (unidad, metro, kg). Todo lo demás se convierte a esta.">
            <Input value={f.unidadBase} onChange={(e) => set("unidadBase")(e.target.value)} />
          </Campo>
          <Campo label="Volumen unitario (m³)" ayuda="Alimenta el ABC físico y la ubicación.">
            <Input type="number" min="0" step="any" value={f.volumen} onChange={(e) => set("volumen")(e.target.value)} />
          </Campo>
          <Campo label="Peso unitario (kg)">
            <Input type="number" min="0" step="any" value={f.peso} onChange={(e) => set("peso")(e.target.value)} />
          </Campo>
          <Campo label="Requiere autoelevador" ayuda="Necesario para el ABC físico.">
            <select
              className={selectCls}
              value={f.requiereAutoelevador ? "si" : "no"}
              onChange={(e) => set("requiereAutoelevador")(e.target.value === "si")}
            >
              <option value="no">no</option>
              <option value="si">sí</option>
            </select>
          </Campo>
          <Campo label="Vida útil (meses)" ayuda="Baterías, precintos, químicos. Vacío si no vence.">
            <Input type="number" min="0" value={f.vidaUtilMeses} onChange={(e) => set("vidaUtilMeses")(e.target.value)} />
          </Campo>
          <Campo label="Stock actual" requerido ayuda="En unidad base. Lo mantiene la sincronización diaria.">
            <Input value={p.stock.toLocaleString("es-AR")} disabled className="font-mono" />
          </Campo>
          <Campo label="En tránsito" ayuda="Ya comprado y viniendo; evita comprar dos veces.">
            <Input type="number" min="0" step="any" value={f.enTransito} onChange={(e) => set("enTransito")(e.target.value)} />
          </Campo>
          <Campo label="Instalaciones proyectadas / mes" ayuda="Para calcular la demanda derivada de un kit.">
            <Input type="number" min="0" value={f.instalacionesMes} onChange={(e) => set("instalacionesMes")(e.target.value)} />
          </Campo>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Guardar ficha
        </Button>
      </div>
    </div>
  );
}
