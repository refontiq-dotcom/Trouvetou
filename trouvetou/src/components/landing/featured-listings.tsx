"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Star, MapPin, Navigation } from "lucide-react";

interface FeaturedListing {
  id: string;
  name: string;
  city: string;
  area: string;
  rating: number;
  reviews: number;
  tags: string[];
  price: string;
  priceSuffix: string;
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
    tags: ["Primaire", "Collège", "Lycée", "Bilingue", "Internat"],
    price: "850,000",
    priceSuffix: "F CFA / an",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=300&fit=crop",
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
    tags: ["Collège", "Lycée", "Classes Préparatoires", "Cantine", "Internat"],
    price: "1,200,000",
    priceSuffix: "F CFA / an",
    image: "https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=300&fit=crop",
    badge: "Populaire",
    actionLabel: "Visite",
  },
];

export function FeaturedListings() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          Écoles & Établissements Scolaires
        </h2>
        <Link
          href="/ecoles"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          Voir tout
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Découvrez les meilleures écoles primaires, collèges et lycées
        en direct de nos partenaires.
      </p>

      {/* Listings grid */}
      <div className="flex flex-col gap-4">
        {LISTINGS.map((listing, i) => (
          <motion.article
            key={listing.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Image */}
            <div className="relative w-full sm:w-48 h-48 sm:h-auto flex-shrink-0">
              <img
                src={listing.image}
                alt={listing.name}
                className="w-full h-full object-cover"
              />
              {listing.badge && (
                <span className="absolute top-3 left-3 bg-accent text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                  {listing.badge}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
              <div>
                {/* Name + Rating */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-foreground text-lg leading-tight">
                    {listing.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                    <Star className="h-4 w-4 text-warning fill-warning" />
                    <span className="font-medium">{listing.rating}</span>
                    <span className="text-xs">({listing.reviews} avis)</span>
                  </div>
                </div>

                {/* Location */}
                <p className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {listing.city} ({listing.area})
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {listing.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price + Actions */}
              <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {listing.price}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {listing.priceSuffix}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.name}, ${listing.city} ${listing.area}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Itinéraire
                  </a>
                  <button className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-1.5 transition-colors shadow-sm">
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
