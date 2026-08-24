"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Ad {
  id: number;
  badge: string;
  logoText: string;
  logoSubtext: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
}

const ADS: Ad[] = [
  {
    id: 1,
    badge: "Publicité",
    logoText: "ECA",
    logoSubtext: "ÉCOLE DES CADRES D'ABIDJAN",
    title: "OFFRE RENTRÉE ECA",
    subtitle: "-15% sur les frais de scolarité pour toute inscription anticipée !",
    cta: "Découvrir",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&h=320&fit=crop",
  },
  {
    id: 2,
    badge: "Publicité",
    logoText: "LES PALMIERS",
    logoSubtext: "RÉSIDENCE MEUBLÉE",
    title: "Studios meublés",
    subtitle: "Dès 15 000 F/nuit à Cocody, Abidjan",
    cta: "Voir l'offre",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=320&fit=crop",
  },
  {
    id: 3,
    badge: "Publicité",
    logoText: "SAINTE-MARIE",
    logoSubtext: "CLINIQUE GÉNÉRALE",
    title: "Consultations",
    subtitle: "Spécialisées, RDV sous 48h à Marcory",
    cta: "Prendre RDV",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=320&fit=crop",
  },
];

export function AdBanner() {
  const [current, setCurrent] = useState(0);

  function next() {
    setCurrent((prev) => (prev + 1) % ADS.length);
  }

  function prev() {
    setCurrent((prev) => (prev - 1 + ADS.length) % ADS.length);
  }

  const ad = ADS[current];

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
      {/* Fixed-size rectangular container */}
      <div className="relative w-full h-[200px] sm:h-[240px] rounded-2xl overflow-hidden shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {/* Full background image */}
            <img
              src={ad.image}
              alt={ad.title}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

            {/* Badge */}
            <span className="absolute top-3 left-4 text-[11px] text-white/70 z-10">
              {ad.badge}
            </span>

            {/* Text content overlaid on image */}
            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8 lg:px-10 z-10 max-w-[70%]">
              {/* Logo */}
              <div className="mb-2">
                <span className="text-lg sm:text-xl font-extrabold text-white leading-none">
                  {ad.logoText}
                </span>
                <span className="block text-[7px] sm:text-[8px] font-medium text-white/60 mt-0.5 uppercase tracking-wider">
                  {ad.logoSubtext}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-base sm:text-xl lg:text-2xl font-bold text-white leading-snug">
                {ad.title}
              </h3>

              {/* Subtitle */}
              <p className="mt-1 text-xs sm:text-sm text-white/80 leading-relaxed">
                {ad.subtitle}
              </p>

              {/* CTA button */}
              <button className="mt-3 inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white border border-white/40 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 w-fit hover:bg-white/10 transition-colors">
                {ad.cta}
                <span>→</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <button
          onClick={prev}
          className="absolute left-3 bottom-3 h-8 w-8 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:text-foreground transition-colors z-20"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={next}
          className="absolute right-3 bottom-3 h-8 w-8 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:text-foreground transition-colors z-20"
          aria-label="Suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Pagination dots */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {ADS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 bg-primary"
                : "w-2 bg-slate-300 hover:bg-slate-400"
            }`}
            aria-label={`Annonce ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
