"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useCompare } from "@/contexts/compare-context";

export function CompareBar() {
  const { items, count, clearCompare, toggleCompare } = useCompare();

  if (count === 0) return null;

  const query = items.map((i) => i.id).join(",");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-white/95 backdrop-blur-md shadow-lg"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              {count}/2
            </span>
            <div className="flex gap-2 min-w-0">
              {items.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                >
                  <span className="truncate max-w-[120px]">{item.name}</span>
                  <button
                    onClick={() => toggleCompare(item)}
                    className="shrink-0 rounded-full p-0.5 hover:bg-primary/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {count < 2 && (
                <span className="text-xs text-muted-foreground self-center">
                  Sélectionnez {2 - count} annonce{2 - count > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearCompare}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Effacer
            </button>
            {count === 2 && (
              <Link
                href={`/compare?ids=${query}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Comparer
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
