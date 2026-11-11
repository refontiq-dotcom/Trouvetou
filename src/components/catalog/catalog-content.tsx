"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  CircleAlert,
  Coins,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  MapPin,
  ArrowDownWideNarrow,
} from "lucide-react";
import { RoomCard } from "@/components/hotels/room-card";
import { RoomCardSkeletonGrid } from "@/components/hotels/room-card-skeleton";
import { BoostedCarousel } from "@/components/hotels/boosted-carousel";
import { Button } from "@/components/ui/button";
import {
  fetchBoostedRooms,
  fetchListedListings,
  sortRooms,
} from "@/lib/supabase/hotels";
import { cn, getCategoryLabel } from "@/lib/utils";
import { detectPortalSuggestion } from "@/lib/search-intent";
import { useLocation } from "@/contexts/location-context";
import { VoiceButton } from "@/components/ui/voice-button";
import { CategoryBanner } from "@/components/catalog/category-banner";
import { FilterDrawer } from "@/components/catalog/filter-drawer";
import { BackLink } from "@/components/layout/back-link";
import type { ListingView } from "@/lib/supabase/listing-view";
import type { CatalogContentConfig } from "@/components/catalog/configs";
import { PAGE_CONTAINER_CLASS } from "@/components/layout/page-container";

const PAGE_SIZE = 15;
const MAX_CLIENT_LIMIT = 60;

const BUDGET_OPTIONS = [
  { label: "Tous", value: 0, icon: Coins, color: "text-muted-foreground" },
  { label: "≤ 15 000", value: 15000, icon: TrendingDown, color: "text-emerald-600" },
  { label: "≤ 30 000", value: 30000, icon: TrendingUp, color: "text-amber-600" },
  { label: "≤ 50 000", value: 50000, icon: Coins, color: "text-orange-600" },
  { label: "≤ 100 000", value: 100000, icon: Coins, color: "text-red-600" },
];

const SORT_OPTIONS = [
  { label: "À proximité", value: "distance", icon: MapPin },
  { label: "Prix ↑", value: "price_asc", icon: TrendingDown },
  { label: "Prix ↓", value: "pr...[truncated]