import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canReceiveCriticalAlerts, consumeCriticalAlerts } from "@/lib/critical-alerts";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!canReceiveCriticalAlerts(user)) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }

  const alerts = await consumeCriticalAlerts(user);
  return NextResponse.json(alerts, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
