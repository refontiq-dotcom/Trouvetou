"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Navigation, Phone } from "lucide-react";

import { fetchListedListings } from "@/lib/supabase/hotels";
import { buildGoogleMapsUrl, formatFCFA, MAX_CLIENT_LIMIT, PLACEHOLDER_IMAGE } from "@/lib/utils";
import { getContactAction } from "@/lib/booking/eligibility";
import type { ListingView } from "@/lib/supabase/listing-view";

function CompareContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = useMemo(
    () =>
      idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    [idsParam]
  );
  const currentPortal =
    pathname.includes("/ecoles") ? "/ecoles" :
    pathname.includes("/cliniques") ? "/cliniques" :
    pathname.includes("/restaurants") ? "/restaurants" :
    "/hotels";

  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) {
      setRooms([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    fetchListedListings({ limit: MAX_CLIENT_LIMIT })
      .then(({ data }) => {
        if (cancelled) return;

        const filtered = data.filter((r) => ids.includes(r.id));
        const matched = ids
          .map((id) => filtered.find((r) => r.id === id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined);

        setRooms(matched);
        setLoading(false);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError("Impossible de charger les annonces.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (ids.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">
          S?lectionnez exactement 2 annonces ? comparer depuis les r?sultats de recherche.
        </p>
        <Link href={currentPortal} className="mt-4 text-sm font-semibold text-primary hover:underline">
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border bg-card p-6">
            <div className="h-48 rounded-xl bg-muted" />
            <div className="mt-4 h-6 w-3/4 rounded bg-muted" />
            <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
            <div className="mt-4 h-4 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive">{error}</p>
        <Link href={currentPortal} className="mt-4 text-sm font-semibold text-primary hover:underline">
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  if (rooms.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Impossible de charger les annonces s?lectionn?es.</p>
        <Link href={currentPortal} className="mt-4 text-sm font-semibold text-primary hover:underline">
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  const [a, b] = rooms;

  const fields = [
    {
      label: "Prix",
      a: a.price ? formatFCFA(a.price) : "?",
      b: b.price ? formatFCFA(b.price) : "?",
    },
    {
      label: "Ville",
      a: a.establishment?.city ?? "?",
      b: b.establishment?.city ?? "?",
    },
    {
      label: "Adresse",
      a: a.establishment?.address ?? "?",
      b: b.establishment?.address ?? "?",
    },
    {
      label: "Capacit?",
      a: a.capacity ? `${a.capacity} pers.` : "?",
      b: b.capacity ? `${b.capacity} pers.` : "?",
    },
    {
      label: "Services",
      a: (a.amenities ?? []).join(", ") || "?",
      b: (b.amenities ?? []).join(", ") || "?",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {[a, b].map((room, idx) => {
        const est = room.establishment;
        const img = room.images[0] ?? PLACEHOLDER_IMAGE;
        const contactAction = getContactAction(room.category_slug);
        const mapsUrl = buildGoogleMapsUrl(
          est?.latitude,
          est?.longitude,
          est?.address ?? est?.city
        );

        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div className="relative h-48 overflow-hidden">
              <img src={img} alt={room.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-5">
              <h3 className="text-lg font-bold text-foreground">{room.name}</h3>
              {est?.city && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {est.city}
                </p>
              )}
              <div className="mt-4 space-y-3">
                {fields.map((f) => (
                  <div key={f.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="max-w-[60%] truncate text-right font-medium text-foreground">
                      {idx === 0 ? f.a : f.b}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5" /> Itin?raire
                  </span>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `${room.name} - ${est?.city ?? ""}
${window.location.origin}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-center text-xs font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/10"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Partager
                  </span>
                </a>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Comparatif</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Comparer 2 annonces</h1>
        </div>
        <Link href="/hotels" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Chargement?</div>}>
        <CompareContent />
      </Suspense>
    </div>
  );
}
