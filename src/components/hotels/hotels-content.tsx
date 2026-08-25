"use client";

import { CatalogContent } from "@/components/catalog/catalog-content";
import { HOTELS_CONFIG } from "@/components/catalog/configs";

interface HotelsContentProps {
  initialQuery?: string;
}

/** Section Hôtels & Résidences (config dédiée sur le composant générique). */
export function HotelsContent({ initialQuery = "" }: HotelsContentProps) {
  return <CatalogContent config={HOTELS_CONFIG} initialQuery={initialQuery} />;
}
