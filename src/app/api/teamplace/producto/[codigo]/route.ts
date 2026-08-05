import { NextResponse } from "next/server";
import { getProducto } from "@/lib/teamplace";

// Detalle completo (ProductoVO) de un producto de Teamplace.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  try {
    const producto = await getProducto(codigo);
    return NextResponse.json(producto);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al consultar Teamplace.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
