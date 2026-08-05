import { NextResponse } from "next/server";
import { getStockPorDeposito } from "@/lib/teamplace";

// Reporte de stock por depósito de Teamplace.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const MonedaID = url.searchParams.get("MonedaID") || "PES";
  const producto = url.searchParams.get("producto") || undefined;
  const deposito = url.searchParams.get("deposito") || undefined;
  const soloStockNoCero = url.searchParams.get("soloStockNoCero") === "true";

  try {
    const data = await getStockPorDeposito({ MonedaID, producto, deposito, soloStockNoCero });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al consultar Teamplace.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
