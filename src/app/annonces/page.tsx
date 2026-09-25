import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { ANNONCES_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Toutes les annonces",
  description: "Parcourez toutes les annonces disponibles sur TrouveTout.",
};

export default function AnnoncesPage() {
  return <CatalogContent config={ANNONCES_CONFIG} />;
}
