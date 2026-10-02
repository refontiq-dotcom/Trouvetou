"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, MapPin, Search } from "lucide-react";
import { detectTargetPortal } from "@/lib/search-intent";
import { LocationPicker } from "@/components/location/location-picker";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import type { HomeCategoryItem } from "@/lib/home-categories";
import { CategoryMenu } from "@/components/home/category-menu";
import { CategoryChips } from "@/components/home/category-chips";
import { HomeHeader } from "@/components/home/home-header";
import { NearbyBar } from "@/components/home/nearby-bar";
import { HomeSidebar } from "@/components/home/home-sidebar";
import { PubBanner } from "@/components/home/pub-banner";
import { ListingCard, type HomeListing } from "@/components/home/listing-card";

/** Ressort doux utilisé pour l'effacement du logo / de la cloche au scroll. */
const SPRING = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.6 };

export function HomeScreen({
  listings,
  categories,
  nearbyCount,
}: {
  listings: HomeListing[];
  categories: HomeCategoryItem[];
  /** Nombre d'établissements proposés autour de la position. */
  nearbyCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Au scroll, le logo et la cloche s'effacent : seule la barre de recherche
  // reste plaquée en haut de l'écran, sans rien d'autre sur le bord.
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 8);
      if (window.scrollY > 8) setNotifOpen(false);
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

        {/* Bandeau sombre des raccourcis catégories */}
        <div className="bg-ink pb-5">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <CategoryChips />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <div className="flex gap-6">
            <div className="min-w-0 flex-1">
              <NearbyBar count={nearbyCount} />

              <div className="mt-4">
                <PubBanner variant="desktop" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 2xl:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>

            {/* Barre latérale — visible dès 1024 px, comme sur la maquette */}
            <aside className="hidden w-[280px] shrink-0 lg:block xl:w-[320px]">
              <HomeSidebar categories={categories} />
            </aside>
          </div>
        </div>
      </div>

      {/* ─────────────── Mobile et tablette ─────────────── */}
    <div className="lg:hidden -mb-20 min-h-[70dvh] bg-ink pb-20 md:mb-0 md:pb-0">
      <div className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-3xl">
        {/* En-tête collant : au scroll, le logo et la cloche s'effacent et
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
          {/* Logo + cloche */}
          <motion.div
            initial={false}
            animate={{
              height: stuck ? 0 : 40,
              opacity: stuck ? 0 : 1,
              marginBottom: stuck ? 0 : 12,
            }}
            transition={SPRING}
            className="flex items-center justify-between overflow-hidden"
          >
            {/* Logo — mobile uniquement (le header desktop l'affiche déjà) */}
            <Link href="/" aria-label="Trouvetou — Accueil" className="md:hidden">
              <Logo size="sm" />
            </Link>

            {/* Cloche de notification */}
            <div className="relative md:ml-auto">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              >
                <Bell className="h-6 w-6" />
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-lime ring-2 ring-ink" />
              </button>
            </div>
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

          {/* Bulle de notifications — ancrée au conteneur pour ne pas être
              coupée quand la rangée du logo s'efface. */}
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute right-4 top-[52px] z-40 w-60 rounded-2xl bg-white p-3.5 text-sm text-neutral-700 shadow-xl"
              >
                Aucune nouvelle notification pour le moment.
              </motion.div>
            )}
          </AnimatePresence>
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
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </div>
    </>
  );
}
