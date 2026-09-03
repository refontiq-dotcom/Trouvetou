import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleAlert } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Réservation créée",
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    id?: string;
    status?: string;
    amount?: string;
    error?: string;
  }>;
}

export default async function SchoolyConfirmationPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { id: reservationId, status, amount, error } = await searchParams;

  const isError = status === "error" || Boolean(error);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <div
        className={`flex flex-col items-center rounded-2xl border bg-white px-6 py-10 text-center shadow-sm ${
          isError
            ? "border-destructive/30"
            : "border-emerald-200"
        }`}
      >
        {isError ? (
          <CircleAlert className="h-12 w-12 text-destructive" />
        ) : (
          <CircleCheck className="h-12 w-12 text-emerald-600" />
        )}

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          {isError
            ? "Le paiement a échoué"
            : "Dossier de réservation créé"}
        </h1>

        {isError ? (
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {error ?? "Le paiement n'a pas pu être confirmé. Aucune place n'a été bloquée pour le moment."}
          </p>
        ) : (
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Votre dossier est enregistré. Pour réserver définitivement une place,
            veuillez procéder au paiement des frais de réservation
            {amount && Number(amount) > 0 ? (
              <>
                {" "}
                (<span className="font-semibold">{formatFCFA(Number(amount))}</span>)
              </>
            ) : null}
            .
          </p>
        )}

        {reservationId && !isError && (
          <p className="mt-3 text-xs text-muted-foreground">
            Référence : <code className="rounded bg-slate-100 px-1.5 py-0.5">{reservationId}</code>
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/ecoles/partenaires/${encodeURIComponent(id)}`}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
          >
            ← Retour à la fiche école
          </Link>
          <Link
            href="/ecoles/partenaires"
            className="inline-flex items-center rounded-lg bg-[#1769e8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#102a72]"
          >
            Voir d&apos;autres écoles
          </Link>
        </div>
      </div>
    </div>
  );
}
