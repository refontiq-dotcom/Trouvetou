"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Navigation, Phone, Scale } from "lucide-react";
import { fetchListedListings } from "@/lib/supabase/hotels";
import {
  buildGoogleMapsUrl,
  formatFCFA,
  getPriceSuffix,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListingView } from "@/lib/supabase/listing-view";

/**
 * La comparaison porte sur les mêmes secteurs que les favoris : sans liste
 * explicite, `fetchListedListings` ne filtre que sur hotel/residence et une
 * école, une clinique ou un restaurant sélectionné serait introuvable.
 */
const COMPARE_CATEGORY_SLUGS = [
  "hotel",
  "residence",
  "school",
  "clinic",
  "restaurant",
];

/** Nombre maximum d'établissements comparables — imposé par le métier. */
const MAX_COMPARE = 2;

/** Ligne de la table de comparaison : libellé + valeur par établissement. */
interface CompareField {
  label: string;
  value: (room: ListingView) => string;
}

const COMPARE_FIELDS: CompareField[] = [
  { label: "Ville", value: (r) => r.establishment?.city ?? "—" },
  { label: "Adresse", value: (r) => r.establishment?.address ?? "—" },
  { label: "Capacité", value: (r) => (r.capacity ? `${r.capacity} pers.` : "—") },
  { label: "Services", value: (r) => (r.amenities ?? []).join(", ") || "—" },
  { label: "Prix", value: (r) => (r.price ? formatFCFA(r.price) : "—") },
];

/** État vide réutilisé pour « aucun établissement » et « un seul » : même action. */
function CompareEmptyState({ withSelection }: { withSelection: boolean }) {
  // Le h1 de la page porte déjà « Comparer des établissements » : le titre ne
  // doit pas le répéter, il doit seulement dire où en est la comparaison.
  return (
    <div className="mt-10 flex flex-col items-center px-4 text-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-tt-lime-tint"
      >
        <Scale className="h-8 w-8 text-tt-ink" />
      </span>
      <h2 className="mt-5 font-display text-lg font-bold text-tt-ink">
        {withSelection
          ? "1 établissement sélectionné"
          : "Aucune comparaison en cours"}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-tt-ink-60">
        {withSelection
          ? "Il reste 1 emplacement pour ajouter un deuxième établissement."
          : "Sélectionnez jusqu'à 2 établissements pour les comparer."}
      </p>
      <Link
        href="/hotels"
        className="tt-tap mt-6 inline-flex items-center justify-center rounded-full bg-tt-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80"
      >
        Choisir des établissements
      </Link>
    </div>
  );
}

/** Squelettes de chargement — primitive `Skeleton` existante, pas de bespoke. */
function CompareSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-tt-card bg-tt-card ring-1 ring-tt-line"
        >
          <Skeleton className="h-44 w-full rounded-none sm:h-48" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  // Signature stable : le paramètre `ids` change la comparaison, pas sa longueur.
  const idsParam = searchParams.get("ids") ?? "";
  const ids = useMemo(
    () => (idsParam ? idsParam.split(",").filter(Boolean) : []),
    [idsParam]
  );

  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [failedFor, setFailedFor] = useState("");

  // Signature de la comparaison en cours. Elle sert de clé d'état : aucune
  // donnée n'est réutilisée d'une URL à l'autre.
  const signature = ids.join(",");

  useEffect(() => {
    // 0 ou 1 établissement : rien à charger. L'interface explique l'étape
    // manquante au lieu d'afficher un écran vide (aucun setState ici).
    if (ids.length < MAX_COMPARE) return;

    let cancelled = false;

    Promise.all(
      COMPARE_CATEGORY_SLUGS.map((slug) =>
        fetchListedListings({ limit: 200, categorySlugs: [slug] })
      )
    )
      .then((results) => {
        if (cancelled) return;
        const all = results.flatMap((result) => result.data);
        const unique = new Map(all.map((room) => [room.id, room]));
        setRooms(
          ids
            .map((id) => unique.get(id))
            .filter((room): room is ListingView => room !== undefined)
        );
        setFailedFor(all.length === 0 ? signature : "");
        setLoadedFor(signature);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedFor(signature);
        setLoadedFor(signature);
      });

    return () => {
      cancelled = true;
    };
    // `signature` identifie la requête ; `ids` en dépendre régénérerait le tableau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // 0 ou 1 établissement : la comparaison n'a pas lieu d'être. On explique
  // l'étape manquante au lieu d'afficher un écran vide sans sortie visible.
  if (ids.length < MAX_COMPARE) {
    return <CompareEmptyState withSelection={ids.length === 1} />;
  }

  // `loadedFor` ne correspond pas tant que la requête courante n'est pas
  // revenue : le chargement est donc DÉRIVÉ de l'état, pas stocké.
  const loading = loadedFor !== signature;

  if (loading) {
    return <CompareSkeleton />;
  }

  if (failedFor === signature) {
    return (
      <p
        role="alert"
        className="mt-6 rounded-tt-card bg-tt-card p-4 text-sm text-tt-ink-60 ring-1 ring-tt-line"
      >
        Impossible de charger les établissements à comparer. Vérifiez votre
        connexion puis réessayez.
      </p>
    );
  }

  if (rooms.length < MAX_COMPARE) {
    // Des IDs sont présents mais introuvables : la comparaison ne peut pas
    // être produite. Le compte exact est indiqué, sans inventer de données.
    return (
      <div className="mt-6 rounded-tt-card bg-tt-card p-5 ring-1 ring-tt-line">
        <h2 className="font-display text-base font-bold text-tt-ink">
          Établissements introuvables
        </h2>
        <p className="mt-1 text-sm text-tt-ink-60">
          {rooms.length} établissement{rooms.length > 1 ? "s" : ""} sur{" "}
          {MAX_COMPARE} n&apos;est plus disponible. Lancez à nouveau la
          comparaison depuis le catalogue.
        </p>
        <Link
          href="/hotels"
          className="tt-tap mt-4 inline-flex items-center justify-center rounded-full bg-tt-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80"
        >
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
      {rooms.map((room, index) => {
        const est = room.establishment;
        const img = room.cover_image_url ?? room.images[0] ?? PLACEHOLDER_IMAGE;
        const mapsUrl = buildGoogleMapsUrl(
          est?.latitude,
          est?.longitude,
          est?.address ?? est?.city
        );
        const contactPhone = est?.whatsapp ?? est?.contact_phone;
        const suffix = getPriceSuffix(room.category_slug);

        return (
          <motion.article
            key={room.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex flex-col overflow-hidden rounded-tt-card bg-tt-card shadow-tt-card ring-1 ring-tt-line"
          >
            <div className="relative h-44 w-full shrink-0 sm:h-48">
              <Image
                src={img}
                alt={room.name}
                fill
                sizes="(min-width: 640px) 45vw, 100vw"
                className="object-cover"
              />
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h2 className="font-display text-base font-bold leading-snug text-tt-ink">
                {room.name}
              </h2>
              {est?.city && (
                <p className="mt-1 flex items-center gap-1 text-sm text-tt-ink-60">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{est.city}</span>
                </p>
              )}

              <dl className="mt-4 space-y-2">
                {COMPARE_FIELDS.map((field) => (
                  <div
                    key={field.label}
                    className="border-b border-tt-line pb-2 last:border-0 last:pb-0"
                  >
                    <dt className="text-xs text-tt-ink-60">{field.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-tt-ink">
                      {field.value(room)}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 text-xs text-tt-ink-60">
                Prix affiché {suffix}
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tt-tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold text-tt-ink transition-colors ring-1 ring-tt-line hover:bg-tt-lime-tint"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Itinéraire
                </a>
                {contactPhone ? (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${room.name} - ${est?.city ?? ""}\n${window.location.origin}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tt-tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold text-tt-ink transition-colors ring-1 ring-tt-line hover:bg-tt-lime-tint"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Contacter
                  </a>
                ) : null}
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

export default function ComparePage() {
  return (
    // Coquille de marque partagée avec l'accueil, le catalogue, le profil et les favoris.
    <div className="tt-shell">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="tt-tap inline-flex items-center gap-1.5 rounded-full px-2 text-sm font-medium text-tt-ink-60 transition-colors hover:text-tt-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-tt-ink sm:text-4xl">
          Comparer des établissements
        </h1>
      <Suspense
        fallback={<p className="mt-6 text-sm text-tt-ink-60">Chargement…</p>}
      >
        <CompareContent />
      </Suspense>
      </div>
    </div>
  );
}
