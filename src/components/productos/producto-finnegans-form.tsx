"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TIPOS } from "@/lib/finnegans-producto";
import { crearProductoYEmpujar } from "@/app/productos/actions";
import { usePushStatus, PushStatus } from "./push-status";

type Categoria = { id: string; nombre: string; codigoSku: string };

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ProductoFinnegansForm({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Campos espejados del form "Nuevo - Productos" de Finnegans Go
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<string>("Otros");
  const [peso, setPeso] = useState("0");
  const [volumen, setVolumen] = useState("0");
  const [rubro, setRubro] = useState("");
  const [marca, setMarca] = useState("");
  const [familia, setFamilia] = useState("");
  const [subfamilia, setSubfamilia] = useState("");
  const [activo, setActivo] = useState(true);
  const [esStockeable, setEsStockeable] = useState(false);
  const [seVende, setSeVende] = useState(false);
  const [seCompra, setSeCompra] = useState(false);
  const [manejaRetenciones, setManejaRetenciones] = useState(false);
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");

  // Seguimiento del push (hook compartido con el resto de la app).
  const [jobId, setJobId] = useState<string | null>(null);
  const { estado, error: errorPush, enCurso } = usePushStatus(jobId, (estadoFinal) => {
    if (estadoFinal === "SINCRONIZADO") {
      toast.success("Producto creado en Finnegans Go");
      router.refresh();
    } else {
      toast.error("El alta en Finnegans Go falló");
    }
  });

  function limpiar() {
    setCodigo("");
    setNombre("");
    setDescripcion("");
    setTipo("Otros");
    setPeso("0");
    setVolumen("0");
    setRubro("");
    setMarca("");
    setFamilia("");
    setSubfamilia("");
    setActivo(true);
    setEsStockeable(false);
    setSeVende(false);
    setSeCompra(false);
    setManejaRetenciones(false);
    setJobId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearProductoYEmpujar({
        codigo,
        nombre,
        descripcion,
        tipo,
        peso,
        volumen,
        rubro,
        marca,
        familia,
        subfamilia,
        activo,
        esStockeable,
        seVende,
        seCompra,
        manejaRetenciones,
        categoriaId,
      });
      if (res.ok) {
        toast.success("Guardado en CentralSM. Lanzando Playwright…");
        setJobId(res.jobId);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* ── Identificación ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Identificación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="codigo">
              Código <span className="text-destructive">*</span>
            </Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: N081032"
              required
              disabled={pending || enCurso}
            />
            <p className="text-xs text-muted-foreground">
              Es el código con el que se crea en Finnegans Go.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Abrazadera Chica"
              required
              disabled={pending || enCurso}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descripcion">Descripción</Label>
          <Textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            disabled={pending || enCurso}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">
              Tipo <span className="text-destructive">*</span>
            </Label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={selectCls}
              disabled={pending || enCurso}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="peso">Peso</Label>
            <Input
              id="peso"
              type="number"
              min="0"
              step="any"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              disabled={pending || enCurso}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="volumen">Volumen</Label>
            <Input
              id="volumen"
              type="number"
              min="0"
              step="any"
              value={volumen}
              onChange={(e) => setVolumen(e.target.value)}
              disabled={pending || enCurso}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Clasificación ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Clasificación</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["rubro", "Rubro", rubro, setRubro],
              ["marca", "Marca", marca, setMarca],
              ["familia", "Familia", familia, setFamilia],
              ["subfamilia", "SubFamilia", subfamilia, setSubfamilia],
            ] as const
          ).map(([id, label, value, setter]) => (
            <div key={id} className="flex flex-col gap-2">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                value={value}
                onChange={(e) => setter(e.target.value)}
                disabled={pending || enCurso}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Estos son campos de búsqueda (F4) en Finnegans: el valor debe existir allá.
        </p>
      </section>

      <Separator />

      {/* ── Flags ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Opciones</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["activo", "Activo", activo, setActivo],
              ["esStockeable", "Es Stockeable", esStockeable, setEsStockeable],
              ["seVende", "Se vende", seVende, setSeVende],
              ["seCompra", "Se Compra", seCompra, setSeCompra],
              ["manejaRetenciones", "Maneja Retenciones", manejaRetenciones, setManejaRetenciones],
            ] as const
          ).map(([id, label, value, setter]) => (
            <label key={id} htmlFor={id} className="flex items-center gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={value}
                onChange={(e) => setter(e.target.checked)}
                disabled={pending || enCurso}
                className="size-4 rounded border-input accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Catálogo CentralSM ─────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Catálogo CentralSM</h2>
        <Label htmlFor="categoria">
          Categoría <span className="text-destructive">*</span>
        </Label>
        <select
          id="categoria"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className={selectCls}
          required
          disabled={pending || enCurso}
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigoSku} — {c.nombre}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Define el SKU local. No se envía a Finnegans.
        </p>
      </section>

      {/* ── Estado del push (componente compartido) ────────────────── */}
      <PushStatus estado={estado} error={errorPush}>
        {estado === "SINCRONIZADO" && (
          <button
            type="button"
            onClick={limpiar}
            className="w-fit text-xs underline underline-offset-2"
          >
            Cargar otro producto
          </button>
        )}
      </PushStatus>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || enCurso || !categorias.length}>
          {(pending || enCurso) && <Loader2 className="size-4 animate-spin" />}
          Crear y cargar en Finnegans Go
        </Button>
        <Button type="button" variant="outline" onClick={limpiar} disabled={pending || enCurso}>
          Limpiar
        </Button>
      </div>

      {!categorias.length && (
        <p className="text-sm text-destructive">
          No hay categorías en el catálogo. Creá una antes de cargar productos.
        </p>
      )}
    </form>
  );
}
