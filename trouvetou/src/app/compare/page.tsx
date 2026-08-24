"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Star, Navigation, Phone } from "lucide-react";
import { fetchListedListings } from "@/lib/supabase/hotels";
import { buildGoogleMapsUrl, formatFCFA, PLACEHOLDER_IMAGE } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

function CompareContent() {
  const searchParams = useSearchParams();
  const ids = searchParams.get("ids")?.split(",") ?? [];
  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length < 2) return;
    let cancelled = false;

    fetchListedListings({ limit: 200 })
      .then(({ data }) => {
        if (!cancelled) {
          setRooms(data.filter((r) => ids.includes(r.id)).slice(0, 2));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ids.join(",")]);

  if (ids.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">
          Sélectionnez exactement 2 annonces à comparer depuis les résultats de recherche.
        </p>
        <Link href="/ecoles" className="mt-4 text-sm font-semibold text-primary hover:underline">
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

  if (rooms.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Impossible de charger les annonces sélectionnées.</p>
        <Link href="/ecoles" className="mt-4 text-sm font-semibold text-primary hover:underline">
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  const [a, b] = rooms;

  const fields = [
    { label: "Prix", a: a.price ? `${formatFCFA(a.price)} F CFA` : "—", b: b.price ? `${formatFCFA(b.price)} F CFA` : "—" },
    { label: "Ville", a: a.establishment?.city ?? "—", b: b.establishment?.city ?? "—" },
    { label: "Adresse", a: a.establishment?.address ?? "—", b: b.establishment?.address ?? "—" },
    { label: "Capacité", a: a.capacity ? `${a.capacity} pers.` : "—", b: b.capacity ? `${b.capacity} pers.` : "—" },
    { label: "Services", a: (a.amenities ?? []).join(", ") || "—", b: (b.amenities ?? []).join(", ") || "—" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {[a, b].map((room, idx) => {
        const est = room.establishment;
        const img = room.images[0] ?? PLACEHOLDER_IMAGE;
        const mapsUrl = buildGoogleMapsUrl(est?.latitude, est?.longitude, est?.address ?? est?.city);

        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
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
                    <span className="font-medium text-foreground text-right max-w-[60%] truncate">{idx === 0 ? f.a : f.b}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Navigation className="h-3.5 w-3.5" /> Itinéraire
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${room.name} - ${est?.city ?? ""}\n${window.location.origin}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" /> Contacter
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">
        Comparer les annonces
      </h1>
      <Suspense fallback={<div className="text-muted-foreground">Chargement…</div>}>
        <CompareContent />
      </Suspense>
    </div>
  );
}
