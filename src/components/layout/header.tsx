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
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between gap-4">
          {/* Groupe gauche : hamburger (mobile) + logo (desktop) */}
          <div className="flex items-center gap-2">
            {/* Hamburger — visible on mobile only, bottom nav handles mobile navigation */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Logo — desktop (gauche) */}
            <Link href="/" className="hidden md:flex items-center gap-2 group">
              <Logo variant="dark" size="sm" className="transition-transform group-hover:scale-105" />
            </Link>
          </div>

          {/* Logo — mobile (centré absolu) */}
          <Link
            href="/"
            className="md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 group"
          >
            <Logo variant="dark" size="sm" className="transition-transform group-hover:scale-105" />
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
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-primary" />
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
              className="relative hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
              aria-label="Mes favoris"
            >
              <Heart className="h-4 w-4" />
              <span className="hidden lg:inline">Favoris</span>
            </Link>

            {/* Favoris — mobile (icône seule, sans badge) */}
            <Link
              href="/favoris"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted sm:hidden"
              aria-label="Mes favoris"
            >
              <Heart className="h-5 w-5" />
            </Link>

            {/* Profil */}
            <Link
              href="/profil"
              className="hidden md:inline-flex items-center rounded-full bg-gradient-to-r from-[#102a72] to-[#1769e8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
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
            className="overflow-hidden border-t border-border bg-white md:hidden"
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
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
