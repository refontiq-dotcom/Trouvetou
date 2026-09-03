import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
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

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href="/ecoles/partenaires"
          className="group flex items-start gap-3 rounded-2xl border border-[#1769e8]/20 bg-gradient-to-r from-[#1769e8]/5 to-[#102a72]/5 px-4 py-3 transition hover:border-[#1769e8]/40 hover:from-[#1769e8]/10"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1769e8] text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Réservez en ligne avec nos écoles partenaires
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Consultez les places disponibles par niveau et créez un dossier
              de réservation en quelques clics.{" "}
              <span className="font-medium text-[#1769e8] group-hover:underline">
                Découvrir →
              </span>
            </p>
          </div>
        </Link>
      </div>
      <CatalogContent config={ECOLES_CONFIG} initialQuery={initialQuery} />
    </div>
  );
}
