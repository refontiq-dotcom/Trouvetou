import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CONTROL_CENTER_URL = process.env.CONTROL_CENTER_URL;
const METRICS_PUSH_SECRET = process.env.METRICS_PUSH_SECRET;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const visits = Number(body?.visits);
    const uniqueVisitors = Number(body?.unique_visitors);

    if (!Number.isInteger(visits) || visits !== 1) {
      return NextResponse.json({ error: "visits doit être égal à 1" }, { status: 400 });
    }

    if (!Number.isInteger(uniqueVisitors) || ![0, 1].includes(uniqueVisitors)) {
      return NextResponse.json(
        { error: "unique_visitors doit être égal à 0 ou 1" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Configuration serveur incomplète" }, { status: 500 });
    }

    const day = todayUtc();
    const db = admin as any;

    const { data: current, error: readError } = await db
      .from("trouvetou_traffic_daily")
      .select("day,visits,unique_visitors")
      .eq("day", day)
      .maybeSingle();

    if (readError) {
      console.error("Trouvetou traffic read error:", readError);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    const next = {
      day,
      visits: Number(current?.visits ?? 0) + 1,
      unique_visitors: Number(current?.unique_visitors ?? 0) + uniqueVisitors,
    };

    const { error: upsertError } = await db
      .from("trouvetou_traffic_daily")
      .upsert(next, { onConflict: "day" });

    if (upsertError) {
      console.error("Trouvetou traffic upsert error:", upsertError);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    if (CONTROL_CENTER_URL && METRICS_PUSH_SECRET) {
      const response = await fetch(
        `${CONTROL_CENTER_URL.replace(/\/$/, "")}/api/traffic/trouvetou`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${METRICS_PUSH_SECRET}`,
          },
          body: JSON.stringify({
            date: day,
            visits: next.visits,
            unique_visitors: next.unique_visitors,
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        console.error(
          "Trouvetou Control Center traffic push failed:",
          response.status
        );
      }
    }

    return NextResponse.json({
      success: true,
      date: day,
      visits: next.visits,
      unique_visitors: next.unique_visitors,
    });
  } catch (error) {
    console.error("Trouvetou traffic error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
