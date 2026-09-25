"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, MapPin, Search, SlidersHorizontal, Stethoscope, GraduationCap, House, Hotel } from "lucide-react";
import { useLocation } from "@/contexts/location-context";
import { LocationPicker } from "@/components/location/location-picker";
import { HomeRecentListings } from "@/components/landing/home-recent-listings";

const CATEGORIES = [
  { label: "Hôtels", href: "/hotels?type=hotel", icon: Hotel },
  { label: "Résidences", href: "/hotels?type=residence", icon: House },
  { label: "Cliniques", href: "/cliniques", icon: Stethoscope },
  { label: "Écoles", href: "/ecoles", icon: GraduationCap },
] as const;

export function HomeMobile() {
  const { location } = useLocation();
  const [locationOpen, setLocationOpen] = useState(false);
  const [query, setQuery] = useState("");

  const locationLabel = location?.label ?? "Abidjan, Côte d'Ivoire";

  function submitSearch() {
    const q = query.trim();
    if (!q) return;
    window.location.href = `/hotels?q=${encodeURIComponent(q)}`;
  }

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-white md:hidden">
      <section className="relative overflow-hidden rounded-b-[28px] bg-[#079b97] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="pointer-events-none absolute -right-16 top-12 h-44 w-44 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-5 top-24 h-28 w-28 rounded-full border border-white/10" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="min-w-0 text-left"
              aria-label="Changer de localisation"
            >
              <span className="block text-[10px] font-medium text-white/55">Localisation</span>
              <span className="mt-1 flex max-w-[245px] items-center gap-1.5 truncate text-sm font-semibold">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{locationLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/70" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("trouvetou:open-notifications"))}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-400" />
            </button>
          </div>

          <form
            className="mt-5 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                aria-label="Rechercher"
                className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#079b97] shadow-sm"
              aria-label="Filtres"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </form>
        </div>
      </section>

      <main className="px-4 pb-6 pt-5">
        <section aria-labelledby="home-offers-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="home-offers-title" className="text-xl font-bold tracking-tight text-slate-900">Annonces / Offres</h2>
            <Link href="/hotels" className="text-xs font-semibold text-[#079b97]">Voir tout</Link>
          </div>
          <div className="-mx-4">
            <HomeAdCarousel />
          </div>
        </section>

        <section aria-labelledby="home-categories-title" className="mt-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="home-categories-title" className="text-xl font-bold tracking-tight text-slate-900">Catégories</h2>
            <Link href="/categories" className="text-xs font-semibold text-[#079b97]">Voir tout</Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.label}
                  href={category.href}
                  className="flex min-w-0 flex-col items-center gap-2 text-center"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fbfa] text-[#079b97] shadow-sm ring-1 ring-[#d9f2f0]">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <span className="w-full truncate text-[11px] font-semibold text-slate-700">{category.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <HomeRecentListings />
      </main>

      {locationOpen && <LocationPicker onClose={() => setLocationOpen(false)} />}
    </div>
  );
}

function HomeAdCarousel() {
  const slides = [
    {
      title: "Trouvez un établissement près de vous",
      subtitle: "Hôtels, résidences, cliniques et écoles réunis sur TrouveTout.",
      href: "/hotels",
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=360&fit=crop",
    },
    {
      title: "Résidences meublées",
      subtitle: "Découvrez les offres disponibles à Abidjan.",
      href: "/hotels?type=residence",
      image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=360&fit=crop",
    },
    {
      title: "Écoles et établissements",
      subtitle: "Trouvez les informations utiles au même endroit.",
      href: "/ecoles",
      image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&h=360&fit=crop",
    },
  ];

  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  return (
    <div>
      <div className="relative h-[158px] overflow-hidden rounded-2xl shadow-sm">
        <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
        <div className="relative z-10 flex h-full max-w-[76%] flex-col justify-center px-5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">TrouveTout</span>
          <h3 className="mt-1 text-base font-extrabold leading-tight text-white">{slide.title}</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-white/80">{slide.subtitle}</p>
          <Link href={slide.href} className="mt-2.5 w-fit rounded-full bg-white px-3.5 py-1.5 text-[10px] font-bold text-[#079b97]">
            Découvrir
          </Link>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {slides.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setCurrent(index)}
            aria-label={`Afficher l'offre ${index + 1}`}
            className={index === current ? "h-2 w-5 rounded-full bg-[#079b97]" : "h-2 w-2 rounded-full bg-slate-200"}
          />
        ))}
      </div>
    </div>
  );
}
