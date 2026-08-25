"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { useFavorites } from "@/contexts/favorites-context";

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
  const { count } = useFavorites();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo — centered */}
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 group"
          >
            <Logo variant="dark" size="sm" className="transition-transform group-hover:scale-105" />
          </Link>

          {/* Favoris — bouton coeur avec compteur */}
          <Link
            href="/favoris"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted"
            aria-label="Mes favoris"
          >
            <Heart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Menu (mobile + desktop) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-border bg-white"
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
