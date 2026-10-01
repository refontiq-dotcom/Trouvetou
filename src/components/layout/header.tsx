"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteSearch, CategoryTabs } from "@/components/layout/site-header-parts";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/hotels", label: "Hôtels" },
  { href: "/ecoles", label: "Écoles" },
  { href: "/cliniques", label: "Cliniques" },
  { href: "/restaurants", label: "Restaurants" },
];

/**
 * Header — zone sombre de marque (encre), conforme à la maquette :
 * logo, puis recherche, puis catégories.
 *
 * Le fond sombre est conservé sur toute la largeur pour que la coquille
 * blanche de la page reste encadrée (cf. `.tt-shell`).
 */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full bg-dark text-white safe-area-pt">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Rangée 1 — logo, navigation, actions */}
        <div className="flex h-16 items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center"
            aria-label="Trouvetou — accueil"
          >
            <Logo variant="light" size="sm" />
          </Link>

          {/* Navigation desktop */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-lime text-ink"
                      : "text-dark-muted hover:bg-dark-2 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Link
              href="/favoris"
              className="tt-tap inline-flex items-center gap-2 rounded-full px-3 text-sm font-medium text-dark-muted transition-colors hover:bg-dark-2 hover:text-white"
            >
              <Heart aria-hidden="true" className="h-5 w-5" />
              <span className="hidden lg:inline">Favoris</span>
              <span className="sr-only lg:hidden">Favoris</span>
            </Link>

            <Link
              href="/profil"
              className="hidden md:inline-flex h-10 items-center rounded-full bg-lime px-4 text-sm font-semibold text-ink transition-colors hover:bg-lime-strong"
            >
              Mon espace
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="tt-tap inline-flex items-center justify-center rounded-xl text-white transition-colors hover:bg-dark-2 md:hidden"
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              aria-controls="menu-mobile"
            >
              {mobileOpen ? (
                <X aria-hidden="true" className="h-6 w-6" />
              ) : (
                <Menu aria-hidden="true" className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Rangée 2 — recherche (mobile : sous le logo) */}
        <SiteSearch className="pb-3 md:max-w-2xl" />

        {/* Rangée 3 — catégories */}
        <CategoryTabs className="pb-3" />
      </div>

      {/* Menu mobile dépliant */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            id="menu-mobile"
            aria-label="Menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-dark-line bg-dark md:hidden"
          >
            <ul className="space-y-1 px-4 py-3">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`tt-tap flex items-center rounded-xl px-4 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-lime text-ink"
                          : "text-dark-muted hover:bg-dark-2 hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
