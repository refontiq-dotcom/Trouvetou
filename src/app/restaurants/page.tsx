import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { RESTAURANTS_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Restaurants & Gastronomie",
  description:
    "Découvrez les restaurants, brasseries et bars partenaires : carte, spécialités et ambiance.",
};

interface RestaurantsPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function RestaurantsPage({ searchParams }: RestaurantsPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={RESTAURANTS_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
