import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

// Almacenamiento de imágenes en disco local.
// En Docker, UPLOADS_DIR=/app/uploads (montado como volumen persistente).
// En el host (sin Docker) cae en ./uploads.
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** URL pública (servida por /api/uploads/[name]) a partir del nombre de archivo. */
export function uploadUrl(fileName: string): string {
  return `/api/uploads/${fileName}`;
}

/** Extrae el nombre de archivo desde una URL guardada (o null si no aplica). */
export function fileNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/api\/uploads\/([A-Za-z0-9._-]+)$/);
  return match ? match[1] : null;
}

/** Guarda un File subido y devuelve la URL pública. */
export async function saveImage(file: File): Promise<string> {
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    throw new Error("Formato de imagen no permitido (usá JPG, PNG, WEBP, GIF o AVIF).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera el máximo de 5 MB.");
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, fileName), bytes);
  return uploadUrl(fileName);
}

/** Lee un archivo guardado para servirlo. Valida el nombre para evitar traversal. */
export async function readImage(fileName: string): Promise<Buffer> {
  if (!/^[A-Za-z0-9._-]+$/.test(fileName) || fileName.includes("..")) {
    throw new Error("Nombre de archivo inválido.");
  }
  return readFile(path.join(UPLOADS_DIR, fileName));
}

/** Borra una imagen (best-effort) a partir de su URL guardada. */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  const name = fileNameFromUrl(url);
  if (!name) return;
  try {
    await unlink(path.join(UPLOADS_DIR, name));
  } catch {
    // si no existe, no pasa nada
  }
}

export function contentTypeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}
