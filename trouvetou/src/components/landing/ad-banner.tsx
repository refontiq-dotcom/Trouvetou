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
    subtitle: "-15% sur les frais de scolarité\npour toute inscription\nanticipée !",
    cta: "Découvrir",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=300&fit=crop",
  },
  {
    id: 2,
    badge: "Publicité",
    logoText: "LES PALMIERS",
    logoSubtext: "RÉSIDENCE MEUBLÉE",
    title: "Studios meublés",
    subtitle: "Dès 15 000 F/nuit\nà Cocody, Abidjan",
    cta: "Voir l'offre",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop",
  },
  {
    id: 3,
    badge: "Publicité",
    logoText: "SAINTE-MARIE",
    logoSubtext: "CLINIQUE GÉNÉRALE",
    title: "Consultations",
    subtitle: "Spécialisées, RDV\nsous 48h à Marcory",
    cta: "Prendre RDV",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop",
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
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
      <div className="relative overflow-hidden rounded-2xl bg-white border border-border shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Badge */}
            <span className="absolute top-3 left-4 text-xs text-muted-foreground z-10">
              {ad.badge}
            </span>

            {/* Horizontal layout: logo | dark text | photo */}
            <div className="flex flex-col sm:flex-row min-h-[180px]">
              {/* Logo area */}
              <div className="flex items-center justify-center sm:w-[140px] p-4 sm:p-6 bg-white">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
                    {ad.logoText}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-wider leading-tight max-w-[120px]">
                    {ad.logoSubtext}
                  </div>
                </div>
              </div>

              {/* Dark text area */}
              <div className="flex-1 bg-[#0d47a1] text-white p-5 sm:p-6 flex flex-col justify-center">
                <h3 className="text-lg sm:text-xl font-bold">
                  {ad.title}
                </h3>
                <p className="mt-1.5 text-sm text-white/80 whitespace-pre-line leading-relaxed">
                  {ad.subtitle}
                </p>
                <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white border border-white/40 rounded-full px-5 py-2 w-fit hover:bg-white/10 transition-colors">
                  {ad.cta}
                  <span className="text-base">→</span>
                </button>
              </div>

              {/* Photo area */}
              <div className="relative sm:w-[200px] lg:w-[260px] h-40 sm:h-auto flex-shrink-0">
                <img
                  src={ad.image}
                  alt={ad.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <button
          onClick={prev}
          className="absolute left-3 bottom-14 sm:bottom-4 h-9 w-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-600 hover:text-foreground transition-colors z-10"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-3 bottom-14 sm:bottom-4 h-9 w-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-600 hover:text-foreground transition-colors z-10"
          aria-label="Suivant"
        >
          <ChevronRight className="h-5 w-5" />
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
