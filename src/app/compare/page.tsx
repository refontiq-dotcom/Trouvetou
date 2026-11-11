"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Navigation, Phone } from "lucide-react";

import { fetchListedListings } from "@/lib/supabase/hotels";
import { buildGoogleMapsUrl, formatFCFA, MAX_CLIENT_LIMIT, PLACEHOLDER_IMAGE } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";
import { PAGE_CONTAINER_CLASS } from "@/components/layout/page-container";

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
  const idsKey = ids.join(",");
  const [loadedIdsKey, setLoadedIdsKey] = useState<string | null>(null);
  const loading = ids.length >= 2 && loadedIdsKey !== idsKey;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) return;

    let cancelled = false;

    fetchListedListings({ limit: MAX_CLIENT_LIMIT })
      .then(({ data }) => {
        if (cancelled) return;

        const filtered = data.filter((r) => ids.includes(r.id));
        const matched = ids
          .map((id) => filtered.find((r) => r.id === id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined);

        setRooms(matched);
        setLoadedIdsKey(idsKey);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedIdsKey(idsKey);
          setError("Impossible...[truncated]