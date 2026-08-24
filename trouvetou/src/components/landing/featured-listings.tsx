"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, Star, MapPin, Navigation, BookOpen, GraduationCap, Globe, Utensils, BedDouble } from "lucide-react";

interface FeaturedListing {
  id: string;
  name: string;
  city: string;
  area: string;
  rating: number;
  reviews: number;
  tags: { label: string; icon?: React.ComponentType<{ className?: string }> }[];
  price: string;
  image: string;
  badge?: string;
  actionLabel: string;
  description?: string;
}

const LISTINGS: FeaturedListing[] = [
  {
    id: "1",
    name: "Groupe Scolaire Elite",
    city: "Abidjan",
    area: "Cocody",
    rating: 4.6,
    reviews: 128,
    tags: [
      { label: "Primaire", icon: BookOpen },
      { label: "Collège", icon: GraduationCap },
      { label: "Lycée", icon: GraduationCap },
      { label: "Bilingue", icon: Globe },
      { label: "Internat", icon: BedDouble },
    ],
    price: "850,000",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&h=350&fit=crop",
    badge: "Plus qu'une",
    actionLabel: "Inscription",
    description: "Établissement d'excellence offrant un programme bilingue français-anglais du primaire au lycée. Campus moderne avec internat, laboratoire et terrains de sport.",
  },
  {
    id: "2",
    name: "Collège Saint-Exupéry",
    city: "Abidjan",
    area: "Plateau",
    rating: 4.4,
    reviews: 96,
    tags: [
      { label: "Collège", icon: GraduationCap },
      { label: "Lycée", icon: GraduationCap },
      { label: "Classes Préparatoires", icon: BookOpen },
      { label: "Cantine", icon: Utensils },
      { label: "Internat", icon: BedDouble },
    ],
    price: "1,200,000",
    image: "https://images.unsplash.com/photo-1562774053-701939374585?w=500&h=350&fit=crop",
    badge: "Populaire",
    actionLabel: "Visite",
    description: "Collège et lycée privé reconnu pour l'excellence de ses résultats au Brevet et au Baccalauréat. Classes préparatoires aux grandes écoles.",
  },
];

export function FeaturedListings() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Section header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          Écoles & Établissements Scolaires
        </h2>
        <Link
          href="/ecoles"
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          Voir tout
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-5">
        Découvrez les meilleures écoles primaires, collèges et lycées
        en direct de nos partenaires.
      </p>

      {/* Listings */}
      <div className="flex flex-col gap-4">
        {LISTINGS.map((listing, i) => {
          const isExpanded = expandedId === listing.id;

          return (
            <motion.article
              key={listing.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-row overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => toggleExpand(listing.id)}
            >
              {/* Image — fixed width, same proportions as hero */}
              <div className="relative w-[130px] sm:w-[200px] lg:w-[240px] flex-shrink-0">
                <img
                  src={listing.image}
                  alt={listing.name}
                  className="w-full h-full object-cover"
                />
                {listing.badge && (
                  <span className="absolute top-2 left-2 bg-[#f9a825] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {listing.badge}
                  </span>
                )}
              </div>

              {/* Content — fits exactly, no wasted space */}
              <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                {/* Top: name + rating */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base lg:text-lg leading-tight truncate">
                      {listing.name}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#f9a825] fill-[#f9a825]" />
                      <span className="text-xs sm:text-sm font-medium text-foreground">{listing.rating}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">({listing.reviews})</span>
                    </div>
                  </div>

                  <p className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {listing.city} ({listing.area})
                  </p>

                  {/* Tags — visible on desktop, hidden on mobile until expanded */}
                  <div className={`${isExpanded ? "flex" : "hidden sm:flex"} flex-wrap gap-1 mt-2`}>
                    {listing.tags.map((tag) => {
                      const TagIcon = tag.icon;
                      return (
                        <span
                          key={tag.label}
                          className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] lg:text-[11px] bg-slate-50 text-slate-600 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200"
                        >
                          {TagIcon && <TagIcon className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-slate-400" />}
                          {tag.label}
                        </span>
                      );
                    })}
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && listing.description && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                          {listing.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bottom: price + actions — always visible */}
                <div className="flex items-end justify-between mt-2 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-sm sm:text-base lg:text-lg font-bold text-foreground leading-tight">
                      {listing.price}{" "}
                      <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                        F CFA / an
                      </span>
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">(Moyenne)</p>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.name}, ${listing.city} ${listing.area}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-slate-600 hover:text-foreground border border-slate-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 transition-colors"
                    >
                      <Navigation className="h-3 w-3" />
                      Itinéraire
                    </a>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded-lg px-3 sm:px-4 py-1 sm:py-1.5 transition-colors shadow-sm"
                    >
                      {listing.actionLabel}
                    </button>
                  </div>
                </div>

                {/* Expand indicator on mobile */}
                <div className="sm:hidden flex justify-center mt-1">
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
