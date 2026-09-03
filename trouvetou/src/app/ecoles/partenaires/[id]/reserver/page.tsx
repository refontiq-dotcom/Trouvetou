import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchSchoolyCatalog,
  isSchoolyConfigured,
  SchoolyApiError,
  SchoolyConfigError,
  type SchoolyEstablishment,
} from "@/lib/schooly";
import { SchoolyReservationForm } from "@/components/ecoles/schooly-reservation-form";
import { formatFCFA } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadEstablishment(id: string): Promise<SchoolyEstablishment | null> {
  if (!isSchoolyConfigured()) return null;
  try {
    const catalog = await fetchSchoolyCatalog();
    return catalog.establishments.find((e) => e.id === id) ?? null;
  } catch (err) {
    if (err instanceof SchoolyConfigError || err instanceof SchoolyApiError) {
      console.error("[ecoles/partenaires/[id]/reserver]", err.message);
    }
    return null;
  }
}

export const metadata: Metadata = {
  title: "Réserver une place",
  description: "Réservez une place dans une école partenaire Schooly.",
};

export default async function SchoolyReservePage({ params }: PageProps) {
  const { id } = await params;
  const establishment = await loadEstablishment(id);
  if (!establishment) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <nav className="text-sm text-muted-foreground">
        <a href="/ecoles/partenaires" className="hover:text-foreground transition">
          Écoles partenaires
        </a>
        <span className="mx-1">/</span>
        <a
          href={`/ecoles/partenaires/${encodeURIComponent(establishment.id)}`}
          className="hover:text-foreground transition"
        >
          {establishment.name}
        </a>
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground">Réserver</span>
      </nav>

      <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
        Réserver une place — {establishment.name}
      </h1>
      {establishment.reservation_fee_amount != null &&
      establishment.reservation_fee_amount > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Frais de réservation :{" "}
          <span className="font-semibold text-foreground">
            {formatFCFA(establishment.reservation_fee_amount)}
          </span>
          . Le paiement sera demandé juste après la création du dossier.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Aucun frais de réservation n&apos;est demandé pour cette école.
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <SchoolyReservationForm
          establishment={establishment}
          action="/api/ecoles/reservations"
          submitLabel="Créer ma réservation"
        />
      </div>
    </div>
  );
}
