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
import { PAGE_CONTAINER_CLASS } from "@/components/layout/page-container";

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
    <div className={PAGE_CONTAINER_CLASS}>
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
          <...[truncated]