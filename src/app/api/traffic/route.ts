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

    const { data, error } = await db.rpc("increment_trouvetou_traffic", {
      p_day: day,
      p_unique_visitors: uniqueVisitors,
    });

    if (error || !data?.[0]) {
      console.error("Trouvetou traffic increment error:", error);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    const next = {
      day: data[0].day,
      visits: Number(data[0].visits),
      unique_visitors: Number(data[0].unique_visitors),
    };

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
            date: next.day,
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
      date: next.day,
      visits: next.visits,
      unique_visitors: next.unique_visitors,
    });
  } catch (error) {
    console.error("Trouvetou traffic error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
