"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Coins, ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

interface FilterDrawerProps {
  budgetOptions: FilterOption[];
  sortOptions: FilterOption[];
  activeBudget: number;
  activeSort: string;
  onBudgetChange: (value: number) => void;
  onSortChange: (value: string) => void;
  onReset: () => void;
}

export function FilterDrawer({
  budgetOptions,
  sortOptions,
  activeBudget,
  activeSort,
  onBudgetChange,
  onSortChange,
  onReset,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  const hasFilters = activeBudget > 0 || activeSort !== "price_asc";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
          hasFilters
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-white text-foreground hover:border-primary/50"
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span>Filtres</span>
        {hasFilters && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {(activeBudget > 0 ? 1 : 0) + (activeSort !== "price_asc" ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Drawer overlay + panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Bottom sheet (mobile) / Modal (desktop) */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:max-h-[85vh]"
            >
              {/* Handle (mobile uniquement) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="h-1 w-10 rounded-full bg-slate-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-foreground">Filtres</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* Budget section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Budget</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {budgetOptions.map((opt) => {
                      const active = activeBudget === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={String(opt.value)}
                          onClick={() => onBudgetChange(opt.value as number)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-white text-foreground hover:border-primary/50"
                          )}
                        >
                          {Icon && <Icon className={cn("h-4 w-4", active ? "text-white" : opt.color)} />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sort section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Trier par</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sortOptions.map((opt) => {
                      const active = activeSort === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={String(opt.value)}
                          onClick={() => onSortChange(opt.value as string)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-white text-foreground hover:border-primary/50"
                          )}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100">
                {hasFilters && (
                  <button
                    onClick={() => { onReset(); setOpen(false); }}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-slate-50 transition-colors"
                  >
                    Tout effacer
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors",
                    hasFilters ? "flex-1" : "w-full"
                  )}
                >
                  Voir les résultats
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
