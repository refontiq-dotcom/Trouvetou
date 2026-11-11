"use client";

import { motion } from "framer-motion";
import { User, MapPin, Heart, Compass, CalendarCheck, LogOut } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useFavorites } from "@/contexts/favorites-context";
import { useLocation } from "@/contexts/location-context";
import { useBookings } from "@/contexts/bookings-context";
import { AlertSubscribe } from "@/components/alerts/alert-subscribe";
import { BackLink } from "@/components/layout/back-link";
import { PAGE_CONTAINER_CLASS } from "@/components/layout/page-container";

const MENU_ITEMS = [
  { href: "/favoris", label: "Mes favoris", icon: Heart, color: "text-red-500" },
  { href: "/ecoles", label: "Parcourir les annonces", icon: Compass, color: "text-primary" },
];

export default function ProfilPage() {
  const { user, signOut } = useAuth();
  const { count: favCount } = useFavorites();
  const { location } = useLocation();
  const { bookings, count: bookingCount } = useBookings();

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Retour sur mobile — le header global n'existe pas sur ce format */}
        <BackLink />

        {/* Avatar + info */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Mon profil</h1>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email ?? "Session non active"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {location ? location.label : "Position non définie"}
            </p>
          </div>
    ...[truncated]