import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Probe liviana para healthchecks (compose/k8s): app viva + DB alcanzable.
// Pública a propósito (ver src/proxy.ts): no expone datos.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "db" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
