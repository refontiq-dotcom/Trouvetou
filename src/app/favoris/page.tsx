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

const MAX_FAVORIS_LIMIT = 120;

export default function FavorisPage() {
  const { favorites, count } = useFavorites();
  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [loadedSignature, setLoadedSignature] = useState("");

  const currentSignature = useMemo(() => Array.from(favorites).sort().join("|"), [favorites]);
  const loading = count > 0 && loadedSignature !== currentSignature;

  useEffect(() => {
    if (count === 0) {
      return;
    }

    let cancelled = false;

    fetchListedListings({ ids: Array.from(favorites) })
      .then(({ data }) => {
        if (!cancelled) {
          setRooms(data);
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <BackLink />

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
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <Heart className="h-8 w-8 text-red-500 fill-red-500" />
          Mes favoris
        </h1>
        <p className="mt-2 text-muted-foreground">
          {count > 0
            ? `${count} annonce${count > 1 ? "s" : ""} sauvegard?e${count > 1 ? "s" : ""}`
            : "Aucune annonce sauvegard?e pour l'instant."}
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
            Parcourez les annonces et appuyez sur le ?? pour les sauvegarder ici.
          </p>
          <Link href="/ecoles" className="mt-6">
            <Button>
              D?couvrir les annonces
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
