"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ArrowRight } from "lucide-react";
import { useFavorites } from "@/contexts/favorites-context";
import { RoomCard } from "@/components/hotels/room-card";
import { RoomCardSkeletonGrid } from "@/components/hotels/room-card-skeleton";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/layout/back-link";
import { fetchListedListings } from "@/lib/supabase/hotels";
import { getPriceSuffix } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

/** Seuil maximal de chargement côté client pour éviter de tout vouloir
 *  télécharger si l'utilisateur a beaucoup de favoris. */
const MAX_FAVORIS_LIMIT = 120;

export default function FavorisPage() {
  const { favorites, count } = useFavorites();
  const [rooms, setRooms] = useState<ListingView[]>([]);
  // Signature des favoris pour laquelle les annonces ont déjà été chargées.
  const [loadedSignature, setLoadedSignature] = useState("");

  const currentSignature = Array.from(favorites).sort().join("|");
  // Le chargement est « vrai » tant que la liste affichée ne correspond pas aux favoris courants.
  const loading = count > 0 && loadedSignature !== currentSignature;

  // Catégories uniques des favoris — calculées après chargement des annonces.
  // Laisser vide ici car les IDs seuls ne suffisent pas : il faudrait joindre
  // avec les données des annonces (optimisation à venir côté SQL).
  const favoriteCategories: string[] = [];

  useEffect(() => {
    if (count === 0) {
      return;
    }

    let cancelled = false;

<<<<<<< HEAD
    // On charge un volume raisonnable et on filtre côté client pour ne garder
    // que les annonces réellement en favori. La liste complète est limitée pour
    // ne pas saturer le client quand les favoris couvrent plusieurs univers.
    const limit = Math.min(favorites.size, MAX_FAVORIS_LIMIT);
    fetchListedListings({ limit })
      .then(({ data }) => {
        if (!cancelled) {
          const filtered = data.filter((r) => favorites.has(r.id));
          setRooms(filtered);
=======
    // Chargement ciblé : seuls les favoris sont demandés à l'API. Charger le
    // catalogue puis filtrer côté client faisait disparaître sans message les
    // favoris situés au-delà de la limite.
    fetchListedListings({ ids: Array.from(favorites) })
      .then(({ data }) => {
        if (!cancelled) {
          setRooms(data);
>>>>>>> origin/main
          setLoadedSignature(currentSignature);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedSignature(currentSignature);
      });

    return () => {
      cancelled = true;
    };
  }, [favorites, count, currentSignature]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Retour sur mobile — le header global n'existe pas sur ce format */}
        <BackLink />

        {/* Fil d'Ariane — « Accueil » est cliquable */}
        <nav
          aria-label="Fil d'Ariane"
          className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link
            href="/"
            className="-ml-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
          >
            Accueil
          </Link>
          <span className="mx-1">/</span>
          <span className="font-medium text-foreground">Mes favoris</span>
        </nav>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-500 fill-red-500" />
          Mes favoris
        </h1>
        <p className="mt-2 text-muted-foreground">
          {count > 0
            ? `${count} annonce${count > 1 ? "s" : ""} sauvegardée${count > 1 ? "s" : ""}`
            : "Aucune annonce sauvegardée pour l'instant."}
        </p>
      </motion.div>

      {loading ? (
        <div className="mt-8">
          <RoomCardSkeletonGrid count={3} />
        </div>
      ) : count === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <Heart className="h-8 w-8 text-red-300" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">
            Aucun favori pour l&apos;instant
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Parcourez les annonces et appuyez sur le ❤️ pour les sauvegarder ici.
          </p>
          <Link href="/ecoles" className="mt-6">
            <Button>
              Découvrir les annonces
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rooms.map((room, i) => (
            <RoomCard key={room.id} room={room} index={i} priceSuffix={getPriceSuffix(room.category_slug)} />
          ))}
        </div>
      )}
    </div>
  );
}
