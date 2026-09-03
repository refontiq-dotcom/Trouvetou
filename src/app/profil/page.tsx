"use client";

import { motion } from "framer-motion";
import { User, MapPin, Heart, Compass, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "@/contexts/favorites-context";
import { useLocation } from "@/contexts/location-context";
import { useBookings } from "@/contexts/bookings-context";
import { AlertSubscribe } from "@/components/alerts/alert-subscribe";

const MENU_ITEMS = [
  { href: "/favoris", label: "Mes favoris", icon: Heart, color: "text-red-500" },
  { href: "/ecoles", label: "Parcourir les annonces", icon: Compass, color: "text-primary" },
];

export default function ProfilPage() {
  const { count: favCount } = useFavorites();
  const { location } = useLocation();
  const { bookings, count: bookingCount } = useBookings();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Avatar + info */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Mon profil</h1>
            <p className="text-sm text-muted-foreground">
              {location ? location.label : "Position non définie"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{favCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Favoris</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{bookingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Réservations</p>
          </div>
        </div>

        {/* Menu */}
        <div className="space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Icon className={`h-5 w-5 ${item.color}`} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Historique réservations */}
        {bookingCount > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Dernières réservations
            </h2>
            <div className="space-y-2">
              {bookings.slice(-3).reverse().map((b, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {b.listing_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.check_in_date} → {b.check_out_date} · {b.number_of_guests} pers.
                    </p>
                  </div>
                  {b.booking_code && (
                    <span className="shrink-0 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {b.booking_code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Position */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Position actuelle
              </p>
              <p className="text-xs text-muted-foreground">
                {location ? location.label : "Non définie"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alertes */}
      <AlertSubscribe />
    </div>
  );
}
