import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { ECOLES_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Écoles & Établissements Privés",
  description:
    "Comparez les écoles, campus et centres de formation partenaires : niveaux, programmes et frais de scolarité en FCFA.",
};

interface EcolesPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function EcolesPage({ searchParams }: EcolesPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={ECOLES_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
