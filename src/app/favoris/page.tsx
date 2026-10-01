"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { useFavorites } from "@/contexts/favorites-context";
import { RoomCard } from "@/components/hotels/room-card";
import { RoomCardSkeletonGrid } from "@/components/hotels/room-card-skeleton";
import { fetchListedListings } from "@/lib/supabase/hotels";
import { getPriceSuffix } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

/**
 * Catégories couvertes par les favoris.
 *
 * `fetchListedListings` ne filtre que sur `hotel` / `residence` par défaut :
 * sans cette liste explicite, un favori école, clinique ou restaurant était
 * invisible alors qu'il est bien enregistré. Les slugs sont ceux des portails
 * du catalogue — aucune valeur métier inventée.
 */
const FAVORITE_CATEGORY_SLUGS = [
  "hotel",
  "residence",
  "school",
  "clinic",
  "restaurant",
];

export default function FavorisPage() {
  const { favorites, count } = useFavorites();
  const [rooms, setRooms] = useState<ListingView[]>([]);
  // Signature des favoris pour lesquels les annonces ont été chargées.
  const [loadedSignature, setLoadedSignature] = useState("");
  const [error, setError] = useState(false);

  const currentSignature = Array.from(favorites).sort().join("|");
  const loading = count > 0 && loadedSignature !== currentSignature;

  useEffect(() => {
    if (count === 0) {
      return;
    }

    let cancelled = false;

    // Chargement par secteur puis filtrage côté client sur les favoris.
    // La déduplication par `id` évite qu'une annonce apparaisse deux fois si
    // elle relevait de plusieurs slugs.
    Promise.all(
      FAVORITE_CATEGORY_SLUGS.map((slug) =>
        fetchListedListings({ limit: 100, categorySlugs: [slug] })
      )
    )
      .then((results) => {
        if (cancelled) return;
        const all = results.flatMap((result) => result.data);
        const unique = new Map(all.map((room) => [room.id, room]));
        setRooms([...unique.values()].filter((room) => favorites.has(room.id)));
        setError(results.some((result) => result.error !== null));
        setLoadedSignature(currentSignature);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoadedSignature(currentSignature);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [favorites, count, currentSignature]);

  return (
    // Coquille de marque partagée avec l'accueil, le catalogue et le profil.
    <div className="tt-shell">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        {/* 1. Titre + compteur réel uniquement */}
        <header>
          <p className="text-sm text-tt-ink-60">Mon espace</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-tt-ink sm:text-4xl">
            Mes favoris
          </h1>
          {count > 0 && (
            <p className="mt-2 text-sm text-tt-ink-60">
              {count} établissement{count > 1 ? "s" : ""} enregistré
              {count > 1 ? "s" : ""}
            </p>
          )}
        </header>

        {/* 2. Chargement / vide / erreur / liste */}
        {loading ? (
          <div className="mt-6">
            <RoomCardSkeletonGrid count={3} />
          </div>
        ) : count === 0 ? (
          <div className="mt-10 flex flex-col items-center px-4 text-center">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-tt-lime-tint"
            >
              <Heart className="h-8 w-8 text-tt-ink" />
            </span>
            <h2 className="mt-5 font-display text-lg font-bold text-tt-ink">
              Aucun favori pour l&apos;instant
            </h2>
            <p className="mt-2 max-w-sm text-sm text-tt-ink-60">
              Touchez le cœur sur une annonce pour la retrouver ici.
            </p>
            <Link
              href="/hotels"
              className="tt-tap mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-tt-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80"
            >
              Découvrir les annonces
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : error && rooms.length === 0 ? (
          <p
            role="alert"
            className="mt-6 rounded-tt-card bg-tt-card p-4 text-sm text-tt-ink-60 ring-1 ring-tt-line"
          >
            Impossible de charger vos favoris. Vérifiez votre connexion puis
            réessayez.
          </p>
        ) : rooms.length === 0 ? (
          // Favoris enregistrés mais introuvables : le compte ne doit jamais
          // disparaître silencieusement.
          <div className="mt-10 flex flex-col items-center px-4 text-center">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-tt-lime-tint"
            >
              <Heart className="h-8 w-8 text-tt-ink" />
            </span>
            <h2 className="mt-5 font-display text-lg font-bold text-tt-ink">
              Vos favoris ne sont plus disponibles
            </h2>
            <p className="mt-2 max-w-sm text-sm text-tt-ink-60">
              {count} annonce{count > 1 ? "s" : ""} enregistrée
              {count > 1 ? "s" : ""} ne sont plus disponibles.
            </p>
            <Link
              href="/hotels"
              className="tt-tap mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-tt-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80"
            >
              Voir les annonces disponibles
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {rooms.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                index={i}
                priceSuffix={getPriceSuffix(room.category_slug)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
