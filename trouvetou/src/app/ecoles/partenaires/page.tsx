import type { Metadata } from "next";
import { ECOLES_PARTENAIRES_CONFIG } from "@/components/ecoles/config";
import { EcolesPartenairesContent } from "@/components/ecoles/ecoles-partenaires-content";
import { fetchSchoolyCatalog, isSchoolyConfigured, SchoolyApiError, SchoolyConfigError } from "@/lib/schooly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Écoles partenaires — Réservation en ligne",
  description:
    "Trouvez une école partenaire, consultez les places disponibles par niveau et réservez en ligne via la plateforme Schooly.",
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function EcolesPartenairesPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  const ready = isSchoolyConfigured();
  let establishments: Awaited<ReturnType<typeof fetchSchoolyCatalog>>["establishments"] = [];
  let errorMessage: string | null = null;

  if (ready) {
    try {
      const catalog = await fetchSchoolyCatalog();
      establishments = catalog.establishments;
    } catch (err) {
      if (err instanceof SchoolyConfigError) {
        errorMessage = err.message;
      } else if (err instanceof SchoolyApiError) {
        errorMessage = `Le service Schooly a répondu : ${err.message}`;
      } else {
        errorMessage = "Impossible de joindre le service Schooly.";
      }
    }
  }

  return (
    <EcolesPartenairesContent
      config={ECOLES_PARTENAIRES_CONFIG}
      ready={ready}
      establishments={establishments}
      errorMessage={errorMessage}
      initialQuery={initialQuery}
    />
  );
}
