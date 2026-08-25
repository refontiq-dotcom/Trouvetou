import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { ECOLES_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Écoles & Établissements Privés",
  description:
    "Comparez les écoles, campus et centres de formation partenaires : niveaux, programmes et frais de scolarité en FCFA.",
};

interface EcolesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function EcolesPage({ searchParams }: EcolesPageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return <CatalogContent config={ECOLES_CONFIG} initialQuery={initialQuery} />;
}
