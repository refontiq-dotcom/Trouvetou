"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Ad {
  id: number;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  logo?: string;
  bgColor: string;
}

const ADS: Ad[] = [
  {
    id: 1,
    badge: "Publicité",
    title: "OFFRE RENTRÉE ECA",
    subtitle: "-15% sur les frais de scolarité pour toute inscription anticipée !",
    cta: "Découvrir",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=250&fit=crop",
    bgColor: "bg-white",
  },
  {
    id: 2,
    badge: "Publicité",
    title: "Résidence Les Palmiers",
    subtitle: "Studios meublés dès 15 000 F/nuit à Cocody",
    cta: "Voir l'offre",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop",
    bgColor: "bg-white",
  },
  {
    id: 3,
    badge: "Publicité",
    title: "Clinique Sainte-Marie",
    subtitle: "Consultations spécialisées, rendez-vous sous 48h",
    cta: "Prendre RDV",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=250&fit=crop",
    bgColor: "bg-white",
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
            className="flex flex-col sm:flex-row"
          >
            {/* Text */}
            <div className="flex-1 p-5 sm:p-6 flex flex-col justify-center">
              <span className="text-xs text-muted-foreground mb-2">
                {ADS[current].badge}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                {ADS[current].title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {ADS[current].subtitle}
              </p>
              <button className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors w-fit">
                {ADS[current].cta}
                <span className="text-lg">→</span>
              </button>
            </div>

            {/* Image */}
            <div className="relative w-full sm:w-56 h-40 sm:h-auto flex-shrink-0">
              <img
                src={ADS[current].image}
                alt={ADS[current].title}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
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
