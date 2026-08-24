"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Star, MapPin, Navigation, Wifi, BookOpen, GraduationCap, Globe, Utensils, BedDouble, Users, Stethoscope } from "lucide-react";

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
  },
];

export function FeaturedListings() {
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
        {LISTINGS.map((listing, i) => (
          <motion.article
            key={listing.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Image — wider to match mockup (~40%) */}
            <div className="relative w-full sm:w-[220px] lg:w-[260px] h-[180px] sm:h-auto flex-shrink-0">
              <img
                src={listing.image}
                alt={listing.name}
                className="w-full h-full object-cover"
              />
              {listing.badge && (
                <span className="absolute top-2.5 left-2.5 bg-[#f9a825] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                  {listing.badge}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
              <div>
                {/* Name + Rating */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-base sm:text-lg leading-tight truncate">
                    {listing.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                    <Star className="h-3.5 w-3.5 text-[#f9a825] fill-[#f9a825]" />
                    <span className="font-medium text-foreground">{listing.rating}</span>
                    <span className="text-xs text-muted-foreground">({listing.reviews} avis)</span>
                  </div>
                </div>

                {/* Location */}
                <p className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {listing.city} ({listing.area})
                </p>

                {/* Tags with icons — matching mockup style */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {listing.tags.map((tag) => {
                    const TagIcon = tag.icon;
                    return (
                      <span
                        key={tag.label}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
                      >
                        {TagIcon && <TagIcon className="h-3 w-3 text-slate-400" />}
                        {tag.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Price + Actions */}
              <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-base sm:text-lg font-bold text-foreground">
                    {listing.price}{" "}
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                      F CFA / an
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">(Moyenne)</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.name}, ${listing.city} ${listing.area}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-foreground border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Itinéraire
                  </a>
                  <button className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-[#1565c0] hover:bg-[#0d47a1] rounded-lg px-4 py-1.5 transition-colors shadow-sm">
                    {listing.actionLabel}
                  </button>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
