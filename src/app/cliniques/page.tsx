import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { CLINIQUES_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Cliniques & Santé",
  description:
    "Comparez les cliniques, cabinets médicaux et centres de santé partenaires : spécialités et tarifs de consultation en FCFA.",
};

interface CliniquesPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function CliniquesPage({ searchParams }: CliniquesPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={CLINIQUES_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
