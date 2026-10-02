"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/hotels", label: "Hôtels" },
  { href: "/ecoles", label: "Écoles" },
  { href: "/cliniques", label: "Cliniques" },
  { href: "/restaurants", label: "Restaurants" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-ink/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between gap-4">
          {/* Groupe gauche : hamburger (mobile) + logo (desktop) */}
          <div className="flex items-center gap-2">
            {/* Hamburger — visible on mobile only, bottom nav handles mobile navigation */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Logo — desktop (gauche) */}
            <Link href="/" className="hidden md:flex items-center gap-2 group">
              <Logo size="sm" className="transition-transform group-hover:scale-105" />
            </Link>
          </div>

          {/* Logo — mobile (centré absolu) */}
          <Link
            href="/"
            className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 group"
          >
            <Logo size="sm" className="transition-transform group-hover:scale-105" />
          </Link>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center gap-1 mx-auto flex-1 justify-center">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive ? "text-lime" : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-lime" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Actions droite */}
          <div className="flex items-center gap-2">
            {/* Favoris — chip desktop (sans badge) */}
            <Link
              href="/favoris"
              className="relative hidden sm:inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:border-lime/50 hover:bg-white/10"
              aria-label="Mes favoris"
            >
              <Heart className="h-4 w-4" />
              <span className="hidden lg:inline">Favoris</span>
            </Link>

            {/* Favoris — mobile (icône seule, sans badge) */}
            <Link
              href="/favoris"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 sm:hidden"
              aria-label="Mes favoris"
            >
              <Heart className="h-5 w-5" />
            </Link>

            {/* Profil */}
            <Link
              href="/profil"
              className="hidden md:inline-flex items-center rounded-full bg-lime px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition-all hover:brightness-105"
            >
              Mon espace
            </Link>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-white/10 bg-ink md:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-3 space-y-1 sm:px-6 lg:px-8">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-lime"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
