import { NextResponse } from "next/server";
import { getPushJob } from "@/lib/finnegans-push";

// Estado de un push a Finnegans Go. La UI hace polling de este endpoint
// mientras el bot de Playwright trabaja en background.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = await getPushJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job no encontrado." }, { status: 404 });
  }
  return NextResponse.json(job, {
    headers: { "Cache-Control": "no-store" },
  });
}
