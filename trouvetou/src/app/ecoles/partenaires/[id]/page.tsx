import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  fetchSchoolyCatalog,
  isSchoolyConfigured,
  SchoolyApiError,
  SchoolyConfigError,
  type SchoolyEstablishment,
} from "@/lib/schooly";
import { SchoolyReservationForm } from "@/components/ecoles/schooly-reservation-form";
import { PLACEHOLDER_IMAGE, formatFCFA, cn } from "@/lib/utils";

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
      console.error("[ecoles/partenaires/[id]]", err.message);
    }
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const establishment = await loadEstablishment(id);
  if (!establishment) {
    return { title: "École introuvable" };
  }
  return {
    title: establishment.name,
    description: establishment.description ?? `${establishment.name} — école partenaire Trouvetou.`,
  };
}

export default async function SchoolyEstablishmentPage({ params }: PageProps) {
  const { id } = await params;
  const establishment = await loadEstablishment(id);

  if (!establishment) {
    notFound();
  }

  const cover = establishment.cover_image_url || PLACEHOLDER_IMAGE;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <nav className="text-sm text-muted-foreground">
        <a href="/ecoles/partenaires" className="hover:text-foreground transition">
          Écoles partenaires
        </a>
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground">{establishment.name}</span>
      </nav>

      <div className="mt-4 grid gap-6 md:grid-cols-[3fr_2fr]">
        <div>
          <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-slate-100">
            <Image
              src={cover}
              alt={establishment.name}
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              className="object-cover"
              priority
            />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {establishment.name}
          </h1>
          {(establishment.address || establishment.city) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[establishment.address, establishment.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {establishment.description && (
            <p className="mt-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {establishment.description}
            </p>
          )}
          {establishment.website_url && (
            <a
              href={establishment.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-[#1769e8] hover:underline"
            >
              Visiter le site de l&apos;établissement →
            </a>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Réserver une place
          </h2>
          {establishment.reservation_fee_amount != null &&
          establishment.reservation_fee_amount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Frais de réservation :{" "}
              <span className="font-semibold text-foreground">
                {formatFCFA(establishment.reservation_fee_amount)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Réservation gratuite.
            </p>
          )}
          <div className="mt-4">
            <SchoolyReservationForm
              establishment={establishment}
              action={`/ecoles/partenaires/${encodeURIComponent(establishment.id)}/reserver`}
              submitLabel="Réserver"
            />
          </div>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          Places disponibles par niveau
        </h2>
        {establishment.availability.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucune information de disponibilité pour le moment.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {establishment.availability.map((level) => {
              const available = level.seats_available > 0;
              return (
                <li
                  key={level.level_id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {level.level_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {level.total_taken}/{level.total_capacity} places prises
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      available
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {available
                      ? `${level.seats_available} place${
                          level.seats_available > 1 ? "s" : ""
                        }`
                      : "Complet"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
