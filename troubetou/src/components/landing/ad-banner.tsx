"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Lien de destination au clic sur le CTA */
  href?: string;
  /** Catégorie ciblée — pour le ciblage contextuel futur */
  category?: string;
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
    href: "/ecoles?q=ECA",
    category: "school",
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
    href: "/hotels?q=LES+PALMIERS",
    category: "hotel",
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
    href: "/cliniques?q=SAINTE-MARIE",
    category: "clinic",
  },
];

const ROTATION_INTERVAL = 5000;

/** Enregistre un clic sur une pub (localStorage MVP) */
function trackAdClick(adId: number) {
  try {
    const key = "trouvetou_ad_clicks";
    const raw = localStorage.getItem(key);
    const clicks: Record<string, number> = raw ? JSON.parse(raw) : {};
    clicks[String(adId)] = (clicks[String(adId)] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(clicks));
  } catch {
    // silent
  }
}

export function AdBanner() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(0); // -1 = prev, 1 = next
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Auto-rotation
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((prev) => (prev + 1) % ADS.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [paused]);

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % ADS.length);
  }, []);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + ADS.length) % ADS.length);
  }, []);

  const goTo = useCallback((index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  }, [current]);

  // Swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger if horizontal swipe > 40px and more horizontal than vertical
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [goNext, goPrev]);

  function handleCtaClick(ad: Ad) {
    trackAdClick(ad.id);
    if (ad.href) {
      window.location.href = ad.href;
    }
  }

  const ad = ADS[current];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
      <div
        className="relative w-full h-[200px] sm:h-[240px] rounded-2xl overflow-hidden shadow-lg group"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Progress bar — shows remaining time */}
        <div className="absolute top-0 left-0 right-0 z-30 h-1 bg-black/20">
          <motion.div
            key={`progress-${current}`}
            className="h-full bg-white/70"
            initial={{ width: "0%" }}
            animate={{ width: paused ? undefined : "100%" }}
            transition={{ duration: ROTATION_INTERVAL / 1000, ease: "linear" }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {/* Background image */}
            <img
              src={ad.image}
              alt={ad.title}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />

            {/* Badge */}
            <span className="absolute top-3 left-4 text-[11px] text-white/60 z-10 uppercase tracking-wide">
              {ad.badge}
            </span>

            {/* Text content */}
            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-8 lg:px-10 z-10 max-w-[70%]">
              <div className="mb-2">
                <span className="text-lg sm:text-xl font-extrabold text-white leading-none">
                  {ad.logoText}
                </span>
                <span className="block text-[7px] sm:text-[8px] font-medium text-white/60 mt-0.5 uppercase tracking-wider">
                  {ad.logoSubtext}
                </span>
              </div>
              <h3 className="text-base sm:text-xl lg:text-2xl font-bold text-white leading-snug">
                {ad.title}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-white/80 leading-relaxed">
                {ad.subtitle}
              </p>
              <button
                onClick={() => handleCtaClick(ad)}
                className="mt-3 inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-white border border-white/40 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 w-fit hover:bg-white/20 active:bg-white/30 transition-colors"
              >
                {ad.cta}
                <span>→</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows — visible on hover/touch */}
        <button
          onClick={goPrev}
          className="absolute left-3 bottom-3 h-8 w-8 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:text-foreground transition-all opacity-0 group-hover:opacity-100 z-20"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={goNext}
          className="absolute right-3 bottom-3 h-8 w-8 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:text-foreground transition-all opacity-0 group-hover:opacity-100 z-20"
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
            onClick={() => goTo(i)}
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
