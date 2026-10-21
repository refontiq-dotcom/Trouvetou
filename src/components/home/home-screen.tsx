"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Search } from "lucide-react";
import { detectTargetPortal } from "@/lib/search-intent";
import { LocationPicker } from "@/components/location/location-picker";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import type { HomeCategoryItem } from "@/lib/home-categories";
import { CategoryMenu } from "@/components/home/category-menu";
import { HomeHeader } from "@/components/home/home-header";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { NearbyBar } from "@/components/home/nearby-bar";
import { PubBanner } from "@/components/home/pub-banner";
import { PublishPromo } from "@/components/home/publish-promo";
import { ListingCard, type ListingView } from "@/components/home/listing-card";
import { ListingDetailModal } from "@/components/listings/listing-detail-modal";

/** Ressort doux utilisé pour l'effacement du logo au scroll. */
const SPRING = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.6 };

/**
 * Accueil sans aucune annonce (base vide ou non configurée).
 * On l'affiche explicitement plutôt que de laisser une grille muette, et on
 * n'affiche jamais d'annonces fictives à la place.
 */
function EmptyCatalog() {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-neutral-800">
        Le catalogue arrive bientôt
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Aucune annonce n&apos;est publiée pour le moment. Revenez dans quelques jours.
      </p>
    </div>
  );
}

export function HomeScreen({
  listings,
  categories,
  nearbyCount,
}: {
  listings: ListingView[];
  categories: HomeCategoryItem[];
  /** Nombre d'établissements proposés autour de la position. */
  nearbyCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  /** Annonce ouverte dans la modale de détail (null = fermée). */
  const [selectedListing, setSelectedListing] = useState<ListingView | null>(null);
  const [stuck, setStuck] = useState(false);

  // Liste dérivée : la catégorie sélectionnée filtre les annonces reçues du
  // serveur, sans état dupliqué ni rendu en cascade.
  const filteredListings = useMemo(
    () =>
      selectedCategory === null
        ? listings
        : listings.filter(
            (listing) => listing.category_slug === selectedCategory
          ),
    [listings, selectedCategory]
  );

  // Au scroll, le logo s'efface : seule la barre de recherche
  // reste plaquée en haut de l'écran, sans rien d'autre sur le bord.
  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const target = q ? detectTargetPortal(q)?.targetHref ?? "/hotels" : "/hotels";
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target);
  }

  return (
    <>
      {/* ─────────────── Desktop (≥ 1024px) ─────────────── */}
      <div className="hidden min-h-[70dvh] bg-[#f6f8fb] lg:block">
        <HomeHeader
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
        />

        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <div className="flex items-start gap-6">
            {/* Barre latérale gauche : catégories */}
            <aside className="sticky top-24 w-[240px] shrink-0 xl:w-[260px]">
              <HomeSidebar
                selectedCategory={selectedCategory}
                onCategorySelect={setSelectedCategory}
                nearbyCount={nearbyCount}
              />

              {/* Appel à l'action : publier une annonce */}
              <PublishPromo className="mt-3" />
            </aside>

            {/* Zone principale : proximité, publicité, annonces */}
            <div className="min-w-0 flex-1">
              <NearbyBar count={nearbyCount} />

              <div className="mt-4">
                <PubBanner variant="desktop" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 2xl:grid-cols-3">
                {filteredListings.length === 0 && <EmptyCatalog />}
                {filteredListings.map((listing, index) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    index={index}
                    onOpen={setSelectedListing}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────── Mobile et tablette ─────────────── */}
      <div className="lg:hidden -mb-20 min-h-[70dvh] bg-ink pb-20 md:mb-0 md:pb-0">
        <div className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-3xl">
          {/* En-tête collant : au scroll, le logo s'efface et
            seule la barre de recherche reste plaquée en haut de l'écran. */}
          <motion.div
            initial={false}
            animate={{ paddingTop: stuck ? 10 : 12, paddingBottom: stuck ? 10 : 12 }}
            transition={SPRING}
            className={cn(
              "sticky top-0 z-30 bg-ink/95 px-4 backdrop-blur-md transition-shadow duration-300 md:top-16",
              stuck && "shadow-[0_12px_28px_-14px_rgba(0,0,0,0.95)]"
            )}
          >
            {/* Logo — mobile uniquement (le header desktop l'affiche déjà) */}
            <motion.div
              initial={false}
              animate={{ height: stuck ? 0 : 40, opacity: stuck ? 0 : 1, marginBottom: stuck ? 0 : 12 }}
              transition={SPRING}
              className="flex items-center justify-between overflow-hidden md:hidden"
            >
              <Link href="/" aria-label="Trouvetou — Accueil">
                <Logo size="sm" />
              </Link>
            </motion.div>

            {/* Barre de recherche + pin de localisation */}
            <form
              onSubmit={handleSubmit}
              className="flex h-14 items-center gap-2.5 rounded-full bg-ink-soft pl-5 pr-2.5"
            >
              <Search className="h-5 w-5 shrink-0 text-white" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Que recherchez-vous ?"
                aria-label="Rechercher"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/50"
              />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-label="Choisir ma position"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              >
                <MapPin className="h-6 w-6 text-lime" />
              </button>
            </form>
          </motion.div>

          <div className="px-4">
            {/* Menu des catégories — seul contrôle de la rangée ; le conteneur
              `relative` sert d'ancrage au panneau déroulant. */}
            <div className="relative mt-1">
              <CategoryMenu categories={categories} />
            </div>

            {/* Carte blanche : PUB + annonces */}
            <section className="mt-4 rounded-[28px] bg-white p-3 shadow-2xl">
              <PubBanner />
              <div className="mt-3 grid grid-cols-2 gap-3">
                {filteredListings.length === 0 && <EmptyCatalog />}
                {filteredListings.map((listing, index) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    index={index}
                    onOpen={setSelectedListing}
                  />
                ))}
              </div>
            </section>

            {/* Appel à l'action : publier une annonce */}
            <PublishPromo className="mt-4" />
          </div>
        </div>
      </div>

      {/* Détail de l'annonce — ouvert au clic sur une carte. */}
      <ListingDetailModal
        room={selectedListing}
        onClose={() => setSelectedListing(null)}
      />

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}