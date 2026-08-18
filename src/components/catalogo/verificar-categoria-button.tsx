"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, BadgeX, ListChecks, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
import { quitarVerificacionCategoria, verificarCategoria } from "@/app/catalogo/actions";
import type { Verificacion } from "@/lib/verificacion-tipos";

const NOMBRE_KEY = "centralsm.verificador-nombre";

type Props = {
  categoriaId: string;
  categoriaNombre: string;
  verificacion: Verificacion;
};

/**
 * Acciones de verificación de una categoría según su estado:
 * sin verificar → "Marcar como verificada"; con cambios → "Re-verificar" + "Ver cambios";
 * verificada → "Quitar verificación".
 */
export function VerificarCategoriaButton({ categoriaId, categoriaNombre, verificacion }: Props) {
  const [open, setOpen] = useState(false);
  const [quitarOpen, setQuitarOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();

  function abrir() {
    // Recordar el último nombre usado en este navegador (hasta que haya usuarios).
    try {
      setNombre(window.localStorage.getItem(NOMBRE_KEY) ?? "");
    } catch {
      setNombre("");
    }
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await verificarCategoria(categoriaId, nombre);
      if (res.ok) {
        try {
          window.localStorage.setItem(NOMBRE_KEY, nombre.trim());
        } catch {
          /* sin localStorage */
        }
        toast.success(`«${categoriaNombre}» marcada como verificada`);
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const reverificar = verificacion.estado === "con_cambios";

  return (
    <>
      {verificacion.estado === "verificada" ? (
        <Button variant="outline" onClick={() => setQuitarOpen(true)}>
          <BadgeX className="size-4" /> Quitar verificación
        </Button>
      ) : (
        <>
          {reverificar && (
            <Button
              variant="ghost"
              render={<Link href={`/catalogo/clasificar?cat=${categoriaId}&orden=reciente`} />}
              nativeButton={false}
              title="Ver los artículos clasificados después de la última verificación"
            >
              <ListChecks className="size-4" /> Ver cambios
            </Button>
          )}
          <Button variant="outline" onClick={abrir}>
            {reverificar ? <RotateCcw className="size-4" /> : <BadgeCheck className="size-4" />}
            {reverificar ? "Re-verificar" : "Marcar como verificada"}
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{reverificar ? "Re-verificar categoría" : "Marcar como verificada"}</DialogTitle>
            <DialogDescription>
              Confirmás que «{categoriaNombre}» está revisada y sus artículos bien clasificados.
              {reverificar && " Se toma como base el contenido actual."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="verif-nombre">Verificada por</Label>
              <Input
                id="verif-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                autoFocus
                required
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                Queda registrado junto con la fecha. Cuando haya usuarios se tomará automáticamente.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !nombre.trim()}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                <BadgeCheck className="size-4" /> {reverificar ? "Re-verificar" : "Verificar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={quitarOpen}
        onOpenChange={setQuitarOpen}
        title={`Quitar verificación de «${categoriaNombre}»`}
        description="La categoría vuelve a figurar como sin verificar. Podés volver a marcarla cuando quieras."
        confirmLabel="Quitar"
        action={() => quitarVerificacionCategoria(categoriaId)}
      />
    </>
  );
}
