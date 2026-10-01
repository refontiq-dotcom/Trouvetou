"use client";

import Link from "next/link";
import {
  Heart,
  Compass,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { useFavorites } from "@/contexts/favorites-context";
import { useBookings } from "@/contexts/bookings-context";
import { AlertSubscribe } from "@/components/alerts/alert-subscribe";
import { ArrivalTrackingAction } from "@/components/bookings/arrival-tracking-action";
import { ProfilLocationCard } from "@/components/profile/profil-location-card";

/**
 * ACTIONS — chaque entrée mène à une activité réelle de l'utilisateur.
 * `href: null` = ancre interne (reste sur la page).
 */
const ACTIONS = [
  {
    href: "/favoris" as string | null,
    label: "Mes favoris",
    hint: "Vos annonces sauvegardées",
    icon: Heart,
  },
  {
    href: null,
    label: "Mes réservations",
    hint: "Suivi de vos réservations",
    icon: CalendarCheck,
  },
  {
    href: "/ecoles",
    label: "Parcourir les annonces",
    hint: "Hôtels, écoles, cliniques, restaurants",
    icon: Compass,
  },
] as const;

export default function ProfilPage() {
  const { count: favCount } = useFavorites();
  const { bookings, count: bookingCount } = useBookings();

  return (
    // Coquille de marque partagée avec l'accueil et le catalogue (cf. `.tt-shell`) :
    // sur mobile, le fond sombre du header reste visible au-dessus de la page.
    <div className="tt-shell">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* 1. Où l'utilisateur se trouve. La ville n'est PAS répétée ici :
            elle vit dans « Ma position », plus bas — un seul affichage. */}
        <header>
          <p className="text-sm text-tt-ink-60">Mon espace</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-tt-ink sm:text-4xl">
            Mon profil
          </h1>
        </header>

        {/* 2. Compteurs affichés UNIQUEMENT s'ils portent une activité réelle :
            deux zéros sans action n'aident pas à comprendre la page. */}
        {(favCount > 0 || bookingCount > 0) && (
          <dl className="mt-6 grid grid-cols-2 gap-3">
            {favCount > 0 && (
              <div className="rounded-tt-card bg-tt-card p-4 text-center ring-1 ring-tt-line">
                <dt className="text-xs text-tt-ink-60">Favoris</dt>
                <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-tt-ink">
                  {favCount}
                </dd>
              </div>
            )}
            {bookingCount > 0 && (
              <div className="rounded-tt-card bg-tt-card p-4 text-center ring-1 ring-tt-line">
                <dt className="text-xs text-tt-ink-60">Réservations</dt>
                <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-tt-ink">
                  {bookingCount}
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* 3. Actions disponibles — réponse immédiate à « que puis-je faire ? » */}
        <h2 className="mt-8 font-display text-lg font-bold text-tt-ink">
          Mes activités
        </h2>
        <ul className="mt-3 space-y-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const favouriteHint =
              action.label === "Mes favoris" && favCount > 0
                ? `${favCount} annonce${favCount > 1 ? "s" : ""} sauvegardée${favCount > 1 ? "s" : ""}`
                : action.hint;

            const content = (
              <>
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tt-lime-soft text-tt-ink"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-tt-ink">
                    {action.label}
                  </span>
                  <span className="block text-xs text-tt-ink-60">
                    {favouriteHint}
                  </span>
                </span>
                {action.href !== null && (
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-tt-ink-60"
                    aria-hidden="true"
                  />
                )}
              </>
            );

            const shell =
              "flex w-full items-center gap-3 rounded-tt-card bg-tt-card p-3 text-left ring-1 ring-tt-line transition-colors hover:bg-tt-lime-tint";

            return (
              <li key={action.label}>
                {action.href === null ? (
                  <a href="#reservations" className={`${shell} block`}>
                    {content}
                  </a>
                ) : (
                  <Link href={action.href} className={`${shell} block`}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {/* 4. Historique des réservations — ancre `#reservations`, atteinte
            depuis l'entrée « Mes réservations ». Suivi d'arrivée inclus. */}
        <h2
          id="reservations"
          className="mt-8 scroll-mt-24 font-display text-lg font-bold text-tt-ink"
        >
          Réservations
        </h2>

        {bookingCount === 0 ? (
          <p className="mt-3 rounded-tt-card bg-tt-card p-4 text-sm text-tt-ink-60 ring-1 ring-tt-line">
            Aucune réservation pour le moment. Vos réservations apparaîtront ici
            avec leur suivi d&apos;arrivée.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {bookings
              .slice(-3)
              .reverse()
              .map((booking, index) => (
                <li
                  key={booking.booking_id ?? `${booking.listing_id}-${index}`}
                  className="rounded-tt-card bg-tt-card p-3 ring-1 ring-tt-line sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tt-lime-soft text-tt-ink"
                    >
                      <CalendarCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-tt-ink">
                        {booking.listing_name}
                      </p>
                      <p className="text-xs text-tt-ink-60">
                        {booking.check_in_date} → {booking.check_out_date} ·{" "}
                        {booking.number_of_guests} pers.
                      </p>
                    </div>
                    {booking.booking_code && (
                      <span className="shrink-0 rounded-md bg-tt-surface px-2 py-0.5 font-mono text-[10px] text-tt-ink-60">
                        {booking.booking_code}
                      </span>
                    )}
                  </div>
                  <ArrivalTrackingAction booking={booking} />
                </li>
              ))}
          </ul>
        )}

        {/* 5. Localisation — affichage UNIQUE de la ville sur cette page. */}
        <h2 className="mt-8 font-display text-lg font-bold text-tt-ink">
          Localisation
        </h2>
        <div className="mt-3">
          <ProfilLocationCard />
        </div>

        {/* 6. Alertes — fonctionnalité conservée (localStorage inchangé). */}
        <div className="mt-8 mb-6 sm:mb-10">
          <AlertSubscribe />
        </div>
      </div>
    </div>
  );
}
