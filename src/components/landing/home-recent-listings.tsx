"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { fetchListedListings } from "@/lib/supabase/hotels";
import { formatFCFA, PLACEHOLDER_IMAGE } from "@/lib/utils";
import { useFavorites } from "@/contexts/favorites-context";
import type { ListingView } from "@/lib/supabase/listing-view";

export function HomeRecentListings() {
  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [loading, setLoading] = useState(true);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    let cancelled = false;
    fetchListedListings({ categorySlugs: ["hotel", "residence", "clinic", "school", "other"], limit: 4 })
      .then(({ data }) => {
        if (!cancelled) setRooms(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-labelledby="home-recent-title" className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="home-recent-title" className="text-xl font-bold tracking-tight text-slate-900">Annonces récentes</h2>
        <Link href="/annonces" className="text-xs font-semibold text-[#079b97]">Voir tout</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-[210px] animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          Aucune annonce récente pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rooms.map((room) => {
            const slug = room.category_slug || room.establishment?.type || "other";
            const href = slug === "school" ? "/ecoles" : slug === "clinic" ? "/cliniques" : slug === "other" ? "/categories" : "/hotels";
            const liked = isFavorite(room.id);
            const image = room.images[0] ?? PLACEHOLDER_IMAGE;
            return (
              <article key={room.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="relative h-[125px]">
                  <Link href={href} className="absolute inset-0">
                    <Image src={image} alt={room.name} fill sizes="(max-width: 640px) 46vw, 240px" className="object-cover" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(room.id)}
                    aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
                    className={liked ? "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm" : "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm backdrop-blur"}
                  >
                    <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                  </button>
                </div>
                <Link href={href} className="block p-3">
                  <h3 className="truncate text-sm font-bold text-slate-900">{room.name}</h3>
                  <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />{room.establishment?.city ?? "Côte d'Ivoire"}
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-[#079b97]">{formatFCFA(room.price ?? 0)}</p>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
