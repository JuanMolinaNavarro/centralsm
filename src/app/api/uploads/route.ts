import { NextResponse } from "next/server";
import { saveImage } from "@/lib/uploads";

// Subida de imágenes (multipart/form-data, campo "file").
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se envió ningún archivo." }, { status: 400 });
    }
    const url = await saveImage(file);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir la imagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
