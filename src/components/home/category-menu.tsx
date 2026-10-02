"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { categoryMeta, type HomeCategoryItem } from "@/lib/home-categories";
import { cn } from "@/lib/utils";

/** Ressort d'ouverture du panneau (même sensations que l'effacement au scroll). */
const SPRING = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.6 };

interface CategoryMenuProps {
  categories: HomeCategoryItem[];
}

/**
 * Pastille « All » de l'accueil — transformée en déclencheur d'un panneau
 * déroulant listant toutes les catégories sous forme de petites cartes.
 * Un clic sur une carte navigue vers le portail de la catégorie.
 */
export function CategoryMenu({ categories }: CategoryMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Fermeture : clic extérieur, touche Échap, défilement de la page.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onScroll = () => close();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open, close]);

  return (
    // Le panneau est positionné en absolu : sa boîte de référence est le
    // conteneur `relative` de la rangée de chips (parent, hors du
    // débordement horizontal), sinon il serait rogné.
    <div ref={rootRef} className="shrink-0">
      {/* Déclencheur */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="category-menu"
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-bold transition-transform active:scale-95",
          open ? "bg-white text-neutral-900" : "bg-lime text-neutral-900"
        )}
      >
        Catégories
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Fond assombri */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* Panneau déroulant */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="category-menu"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0, transition: { duration: 0.16 } }}
            transition={SPRING}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-3xl bg-white p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900">
                Toutes les catégories
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer le menu des catégories"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category, i) => {
                const meta = categoryMeta(category.slug);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={category.slug}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                  >
                    <Link
                      href={meta.href}
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50 p-2.5 transition-colors hover:border-lime/60 hover:bg-lime/5 active:scale-[0.97]"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          meta.chipBg
                        )}
                      >
                        <Icon className={cn("h-4 w-4", meta.chipText)} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-neutral-900">
                          {category.label}
                        </span>
                        <span className="block text-[11px] text-neutral-500">
                          {category.count} annonce{category.count > 1 ? "s" : ""}
                        </span>
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}