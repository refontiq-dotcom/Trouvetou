"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Building2,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/hotels/booking-modal";
import {
  buildGoogleMapsUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  getCategoryLabel,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

interface RoomCardProps {
  room: ListingView;
  index?: number;
  /** Libellé du prix affiché sous le montant (défaut : "par nuit"). */
  priceSuffix?: string;
}

export function RoomCard({ room, index = 0, priceSuffix = "par nuit" }: RoomCardProps) {
  const [bookingOpen, setBookingOpen] = useState(false);

  const establishment = room.establishment;
  const coverImage = room.images[0] ?? PLACEHOLDER_IMAGE;
  const amenities = getAmenitiesInfo(room.amenities ?? []).slice(0, 4);
  const mapsUrl = buildGoogleMapsUrl(
    establishment?.latitude,
    establishment?.longitude,
    establishment?.address ?? establishment?.city
  );

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: Math.min(index % 6, 4) * 0.06 }}
        whileHover={{ y: -4 }}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-300 hover:shadow-xl",
          room.is_boosted
            ? "border-accent/60 shadow-accent/20 ring-1 ring-accent/40 hover:shadow-accent/30"
            : "border-border hover:shadow-primary/10"
        )}
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={coverImage}
            alt={room.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading={index < 3 ? "eager" : "lazy"}
          />

          <div className="absolute left-3 top-3 flex flex-col gap-2">
            <Badge variant="accent" className="shadow-sm">
              {establishment?.type ? getCategoryLabel(establishment.type) : "Établissement"}
            </Badge>
          </div>

          {room.is_boosted && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-yellow-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-foreground shadow-lg shadow-accent/40">
              <Sparkles className="h-3 w-3" />
              Sponsorisé
            </div>
          )}

          {room.capacity != null && room.capacity > 0 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Users className="h-3.5 w-3.5" />
              {room.capacity} pers.
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-foreground">
              {establishment?.name ?? "Établissement"}
            </span>
          </div>

          <h3 className="mt-1.5 truncate text-lg font-semibold text-foreground">
            {room.name}
          </h3>

          {establishment?.city && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {establishment.city}
                {establishment.country ? `, ${establishment.country}` : ""}
              </span>
            </div>
          )}

          {amenities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {amenities.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-lg font-bold text-foreground">
                {formatFCFA(room.price ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">{priceSuffix}</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
            >
              <Navigation className="h-4 w-4" />
              Itinéraire
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setBookingOpen(true)}
            >
              <Phone className="h-4 w-4" />
              Réserver / Contacter
            </Button>
          </div>
        </div>
      </motion.article>

      <BookingModal
        room={room}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        priceSuffix={priceSuffix}
      />
    </>
  );
}
