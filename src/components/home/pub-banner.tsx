"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PubAd {
  id: number;
  image: string;
  /** 1ʳᵉ ligne du titre (blanc). */
  titleLine1: string;
  /** 2ᵉ ligne du titre (vert lime). */
  titleLine2: string;
  tags: string[];
  href: string;
}

const ADS: PubAd[] = [
  {
    id: 1,
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=560&fit=crop",
    titleLine1: "Votre espace de rêve",
    titleLine2: "vous attend !",
    tags: ["Maisons", "Appartements", "Résidences"],
    href: "/hotels",
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&h=560&fit=crop",
    titleLine1: "Offre rentrée ECA",
    titleLine2: "-15% de scolarité !",
    tags: ["Écoles", "Inscriptions", "Abidjan"],
    href: "/ecoles?q=ECA",
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=560&fit=crop",
    titleLine1: "Studios meublés",
    titleLine2: "Dès 15 000 F / nuit",
    tags: ["Cocody", "Meublé", "Wi-Fi"],
    href: "/hotels?q=LES+PALMIERS",
  },
];

const ROTATION_INTERVAL = 6000;

/** Enregistre un clic sur une pub (localStorage MVP). */
function trackAdClick(adId: number) {
  try {
    const key = "trouvetou_ad_clicks";
    const raw = localStorage.getItem(key);
    const clicks: Record<string, number> = raw ? JSON.parse(raw) : {};
    clicks[String(adId)] = (clicks[String(adId)] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(clicks));
  } catch {
    // silencieux
  }
}

/** Bannière PUB de l'accueil.
 *  - `mobile` : badge « PUB » + flèche blanche (maquette mobile)
 *  - `desktop` : badge « PUBLICITÉ » + bouton lime « Découvrir »
 */
export function PubBanner({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const isDesktop = variant === "desktop";
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else {
        setDirection(-1);
        setCurrent((prev) => (prev - 1 + ADS.length) % ADS.length);
      }
    }
  }, [goNext]);

  const ad = ADS[current];

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        isDesktop ? "h-[300px] 2xl:h-[340px]" : "h-[210px] sm:h-[250px]"
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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
          <img
            src={ad.image}
            alt={ad.titleLine1}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
        </motion.div>
      </AnimatePresence>

      {/* Badge */}
      <span className="absolute left-4 top-4 z-10 rounded-full bg-lime px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-neutral-900">
        {isDesktop ? "PUBLICITÉ" : "PUB"}
      </span>

      {/* Flèche : passe à la pub suivante (mobile) */}
      {!isDesktop && (
        <button
          type="button"
          onClick={goNext}
          aria-label="Publicité suivante"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* CTA lime (desktop) */}
      {isDesktop && (
        <Link
          href={ad.href}
          onClick={() => trackAdClick(ad.id)}
          className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-neutral-900 transition-transform hover:-translate-y-0.5"
        >
          Découvrir
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      {/* Clic sur la bannière → annonce */}
      <Link
        href={ad.href}
        aria-label={ad.titleLine1}
        onClick={() => trackAdClick(ad.id)}
        className="absolute inset-0 z-0"
      />

      {/* Texte */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4",
          isDesktop && "pr-48"
        )}
      >
        <h3 className="text-xl font-extrabold leading-tight text-white sm:text-2xl">
          {ad.titleLine1}{" "}
          <span className="text-lime">{ad.titleLine2}</span>
        </h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-medium text-white/90">
          {ad.tags.map((tag, i) => (
            <span key={tag} className="flex items-center gap-x-1.5">
              {i > 0 && <span className="text-lime">•</span>}
              {tag}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
