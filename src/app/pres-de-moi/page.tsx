"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Navigation, Search } from "lucide-react";
import { RoomCard } from "@/components/hotels/room-card";
import { useLocation } from "@/contexts/location-context";
import { toListingViews, type ListingView } from "@/lib/supabase/listing-view";

const RADIUS_KM = 25;

export default function NearbyPage() {
  const { location, loading, requestAutoLocation, clearSavedLocation } = useLocation();
  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "permission" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setError(null);
      await requestAutoLocation();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [requestAutoLocation]);

  useEffect(() => {
    if (loading) return;
    if (!location) {
      setStatus("permission");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/catalog/nearby?lat=" + encodeURIComponent(location.lat) + "&lng=" + encodeURIComponent(location.lng) + "&radius=" + RADIUS_KM, { cache: "no-store" });
        const body = (await res.json()) as { data?: unknown[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Impossible de récupérer les annonces.");
        if (!cancelled) {
          setRooms(toListingViews((body.data ?? []) as Parameters<typeof toListingViews>[0]));
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur inconnue");
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [location, loading]);

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <div className="mt-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Près de moi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Annonces réelles situées dans un rayon de {RADIUS_KM} km autour de votre position GPS.
            </p>
          </div>
        </div>

        {status === "loading" && (
          <div className="mt-10 flex flex-col items-center rounded-3xl border bg-card px-6 py-16 text-center">
            <Navigation className="h-8 w-8 animate-pulse text-primary" />
            <p className="mt-4 font-semibold">Localisation GPS en cours…</p>
            <p className="mt-1 text-sm text-muted-foreground">Nous n'utilisons pas une ville comme approximation.</p>
          </div>
        )}

        {status === "permission" && (
          <div className="mt-10 flex flex-col items-center rounded-3xl border bg-card px-6 py-16 text-center">
            <MapPin className="h-8 w-8 text-primary" />
            <p className="mt-4 font-semibold">Position GPS nécessaire</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Pour éviter les faux résultats « près de moi », Trouvetou affiche uniquement des annonces dont les coordonnées GPS réelles peuvent être calculées par rapport à votre position.
            </p>
            <button onClick={requestAutoLocation} className="mt-5 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
              Autoriser ma position
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="mt-10 rounded-3xl border border-destructive/20 bg-card px-6 py-12 text-center">
            <p className="font-semibold">Impossible de charger les annonces proches.</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{rooms.length} annonce{rooms.length !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Coordonnées GPS disponibles · triées par distance</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                Rayon {RADIUS_KM} km
              </span>
            </div>

            {rooms.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-4 font-semibold">Aucune annonce avec une position GPS réelle à proximité.</p>
                <p className="mt-2 text-sm text-muted-foreground">Nous ne remplaçons pas ce résultat par des annonces d'une ville voisine.</p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rooms.map((room, i) => (
                  <RoomCard key={room.id} room={room} index={i} priceSuffix="par nuit" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
