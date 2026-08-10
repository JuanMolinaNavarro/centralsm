"use client";

import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Botón "i" que abre la explicación completa de un bloque de la ficha.
 * Los ítems siguen el patrón del prototipo: ¿qué es? / ¿para qué sirve? / ojo con.
 */
export function InfoDialog({
  titulo,
  intro,
  children,
}: {
  titulo: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Explicación: ${titulo}`} />
        }
      >
        <Info className="size-3.5 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {intro && <DialogDescription>{intro}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Fila etiquetada de un modal informativo (— ¿Qué es? / — Efecto / — Ejemplo). */
export function InfoFila({
  etiqueta,
  tono = "azul",
  children,
}: {
  etiqueta: string;
  tono?: "azul" | "verde" | "rojo";
  children: React.ReactNode;
}) {
  const color =
    tono === "verde"
      ? "text-emerald-600 dark:text-emerald-400"
      : tono === "rojo"
        ? "text-red-600 dark:text-red-400"
        : "text-primary";
  return (
    <div className="mb-2">
      <span className={`block font-mono text-[11px] uppercase tracking-wide ${color}`}>
        — {etiqueta}
      </span>
      <p className="mt-0.5 leading-relaxed">{children}</p>
    </div>
  );
}

/** Sección con título dentro de un modal informativo. */
export function InfoItem({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-3 first:border-t-0 first:pt-0">
      <h5 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wide text-primary">
        {titulo}
      </h5>
      {children}
    </div>
  );
}
