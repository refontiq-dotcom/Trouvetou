"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, MapPin, Users } from "lucide-react";
import { PLACEHOLDER_IMAGE, formatFCFA, cn } from "@/lib/utils";
import type { SchoolyEstablishment } from "@/lib/schooly";

interface SchoolyEstablishmentCardProps {
  establishment: SchoolyEstablishment;
  index?: number;
}

export function SchoolyEstablishmentCard({
  establishment,
  index = 0,
}: SchoolyEstablishmentCardProps) {
  const cover = establishment.cover_image_url || PLACEHOLDER_IMAGE;
  const totalAvailable = establishment.availability.reduce(
    (acc, level) => acc + Math.max(level.seats_available, 0),
    0
  );
  const hasSeats = totalAvailable > 0;
  const fee = establishment.reservation_fee_amount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.04 }}
    >
      <Link
        href={`/ecoles/partenaires/${encodeURIComponent(establishment.id)}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#1769e8]/40 hover:shadow-md"
      >
        <div className="relative h-40 w-full overflow-hidden bg-slate-100">
          <Image
            src={cover}
            alt={establishment.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition group-hover:scale-105"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-[#1769e8]">
            <GraduationCap className="h-3.5 w-3.5" />
            {schoolTypeLabel(establishment.school_type)}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-1 text-base font-semibold text-foreground">
            {establishment.name}
          </h3>
          {establishment.city || establishment.address ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">
                {[establishment.address, establishment.city]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </p>
          ) : null}
          <p
            className={cn(
              "mt-auto flex items-center gap-1 text-xs font-medium",
              hasSeats ? "text-emerald-600" : "text-amber-600"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {hasSeats
              ? `${totalAvailable} place${totalAvailable > 1 ? "s" : ""} disponible${
                  totalAvailable > 1 ? "s" : ""
                }`
              : "Plus de place pour le moment"}
          </p>
          {fee != null && fee > 0 ? (
            <p className="text-xs text-muted-foreground">
              Frais de réservation :{" "}
              <span className="font-semibold text-foreground">
                {formatFCFA(fee)}
              </span>
            </p>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}

function schoolTypeLabel(type: string | null): string {
  if (!type) return "École";
  switch (type.toLowerCase()) {
    case "college":
      return "Collège";
    case "lycee":
    case "lycée":
      return "Lycée";
    case "primaire":
      return "Primaire";
    case "maternelle":
      return "Maternelle";
    case "universite":
    case "université":
      return "Université";
    case "centre_formation":
      return "Centre de formation";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
