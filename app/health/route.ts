import { NextResponse } from "next/server";

// Sonde de santé pour les health checks Coolify (et tout orchestrateur).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({ status: "ok", service: "mnemo" });
}
