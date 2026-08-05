import { NextResponse } from "next/server";
import { readImage, contentTypeFor } from "@/lib/uploads";

// Sirve una imagen guardada en disco.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  try {
    const buffer = await readImage(name);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFor(name),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  }
}
