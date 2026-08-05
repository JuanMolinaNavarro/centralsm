"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
};

export function ImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File) {
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir la imagen.");
      onChange(data.url as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Vista previa" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" />
        )}
        {subiendo && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Cambiar" : "Subir imagen"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={subiendo}
              onClick={() => onChange(null)}
            >
              <X className="size-4" /> Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, WEBP o GIF · máx. 5 MB</p>
      </div>
    </div>
  );
}
