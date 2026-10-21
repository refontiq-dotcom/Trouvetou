import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { HOTELS_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Hôtels & Résidences Meublées",
  description:
    "Parcourez les chambres, studios et appartements meublés disponibles à la nuit, à la semaine ou au mois, publiés par nos établissements partenaires.",
};

interface HotelsPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  // `?type=hotel` ou `?type=residence` : la page s'ouvre filtrée sur la
  // catégorie demandée (lien depuis l'accueil, partage d'annonce).
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={HOTELS_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
