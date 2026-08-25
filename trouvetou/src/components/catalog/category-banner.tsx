"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface CategoryBannerAd {
  /** Catégorie cible (clinic, school, hotel, restaurant) */
  category: string;
  /** Logo texte */
  logoText: string;
  /** Sous-titre logo */
  logoSubtext: string;
  /** Titre de l'offre */
  title: string;
  /** Description */
  description: string;
  /** Texte du bouton CTA */
  cta: string;
  /** Lien de destination */
  href: string;
  /** Couleur d'accent */
  accent: string;
  /** Emoji décoratif */
  emoji: string;
}

/** Bannières par catégorie — chaque partenaire est mappé à sa catégorie */
const CATEGORY_ADS: Record<string, CategoryBannerAd> = {
  clinic: {
    category: "clinic",
    logoText: "SAINTE-MARIE",
    logoSubtext: "CLINIQUE GÉNÉRALE",
    title: "🏥 Consultations spécialisées",
    description: "RDV sous 48h · Cardiologie, Dermatologie, Pédiatrie à Marcory",
    cta: "Prendre RDV",
    href: "/cliniques?q=SAINTE-MARIE",
    accent: "from-[#0ea5e9] to-[#0284c7]",
    emoji: "🏥",
  },
  school: {
    category: "school",
    logoText: "ECA",
    logoSubtext: "ÉCOLE DES CADRES D'ABIDJAN",
    title: "🏫 Offre Rentrée 2025",
    description: "-15% sur les frais de scolarité · Inscriptions anticipées ouvertes",
    cta: "Découvrir",
    href: "/ecoles?q=ECA",
    accent: "from-[#1769e8] to-[#102a72]",
    emoji: "🎓",
  },
  hotel: {
    category: "hotel",
    logoText: "LES PALMIERS",
    logoSubtext: "RÉSIDENCE MEUBLÉE",
    title: "🏨 Studios meublés",
    description: "Dès 15 000 F/nuit · Cocody, Abidjan · WiFi + Clim inclus",
    cta: "Voir l'offre",
    href: "/hotels?q=LES+PALMIERS",
    accent: "from-[#f5a400] to-[#e8890c]",
    emoji: "🏨",
  },
  residence: {
    category: "residence",
    logoText: "LES PALMIERS",
    logoSubtext: "RÉSIDENCE MEUBLÉE",
    title: "🏠 Appartements meublés",
    description: "Dès 15 000 F/nuit · Cocody · Autonomie totale",
    cta: "Voir l'offre",
    href: "/hotels?q=LES+PALMIERS",
    accent: "from-[#f5a400] to-[#e8890c]",
    emoji: "🏠",
  },
  restaurant: {
    category: "restaurant",
    logoText: "LE TERROIR",
    logoSubtext: "RESTAURANT & BAR",
    title: "🍽️ Spécialités ivoiriennes",
    description: "Attiéké, alloco, braisés · Terrace & soirée live",
    cta: "Voir le menu",
    href: "/restaurants?q=LE+TERROIR",
    accent: "from-[#f97316] to-[#c2410c]",
    emoji: "🍽️",
  },
};

const DISMISS_KEY = "trouvetou_category_banner_dismissed";

interface CategoryBannerProps {
  /** Slug de la catégorie courante */
  categorySlug: string;
}

export function CategoryBanner({ categorySlug }: CategoryBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const dismissedMap: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      return !!dismissedMap[categorySlug];
    } catch {
      return false;
    }
  });

  const ad = CATEGORY_ADS[categorySlug];

  function handleDismiss() {
    setDismissed(true);
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const dismissedMap: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      dismissedMap[categorySlug] = true;
      localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissedMap));
    } catch {
      // silent
    }
  }

  if (!ad || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r shadow-md">
          {/* Gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-r ${ad.accent}`} />

          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDE0em0wLTRWMjhIMjR2MmgxNHoiLz48L2c+PC9nPjwvc3ZnPg==')]" />

          <div className="relative flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Emoji icon */}
              <span className="flex-shrink-0 text-2xl sm:text-3xl">{ad.emoji}</span>

              {/* Text content */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                    {ad.logoText}
                  </span>
                  <span className="hidden sm:inline text-[8px] text-white/50 uppercase tracking-wider">
                    {ad.logoSubtext}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                  {ad.title}
                </h4>
                <p className="text-[11px] sm:text-xs text-white/80 truncate">
                  {ad.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={ad.href}
                className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/30 transition-colors whitespace-nowrap"
              >
                {ad.cta}
                <span>→</span>
              </a>
              <button
                onClick={handleDismiss}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
