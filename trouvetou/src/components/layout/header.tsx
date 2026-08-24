"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/hotels", label: "Hôtels" },
  { href: "/ecoles", label: "Écoles" },
  { href: "/cliniques", label: "Cliniques" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors duration-300",
        isHome
          ? "border-white/10 bg-[#0d47a1]/95 backdrop-blur-md"
          : "border-border bg-white/90 backdrop-blur-md"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Logo
              variant={isHome ? "light" : "dark"}
              size="sm"
              className="transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    isHome
                      ? isActive
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                      : isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Link
              href="/hotels"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:bg-accent-hover hover:shadow-md hover:shadow-accent/20"
            >
              Explorer
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
              isHome
                ? "border-white/20 text-white"
                : "border-border text-foreground"
            )}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <motion.div
        className="md:hidden overflow-hidden"
        initial={false}
        animate={{ height: mobileOpen ? "auto" : 0, opacity: mobileOpen ? 1 : 0 }}
        transition={{ duration: 0.22 }}
      >
        <nav className={cn("px-4 pb-4 space-y-1", !mobileOpen && "hidden")}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                isHome
                  ? "text-white/80 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/hotels"
            onClick={() => setMobileOpen(false)}
            className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground"
          >
            Explorer
          </Link>
        </nav>
      </motion.div>
    </header>
  );
}
