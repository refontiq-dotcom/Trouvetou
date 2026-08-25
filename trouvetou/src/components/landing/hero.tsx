"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Stethoscope, GraduationCap, Building2, UtensilsCrossed } from "lucide-react";
import { detectTargetPortal } from "@/lib/search-intent";
import { VoiceButton } from "@/components/ui/voice-button";

const QUICK_CHIPS = [
  { label: "Clinique", icon: Stethoscope, query: "clinique", color: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" },
  { label: "École", icon: GraduationCap, query: "école", color: "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10" },
  { label: "Restaurant", icon: UtensilsCrossed, query: "restaurant", color: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100" },
  { label: "Hôtel", icon: Building2, query: "hôtel", color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" },
];

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const target = q ? detectTargetPortal(q)?.targetHref ?? "/ecoles" : "/ecoles";
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target);
  }

  function handleChipClick(chipQuery: string) {
    setQuery(chipQuery);
    const target = detectTargetPortal(chipQuery)?.targetHref ?? "/ecoles";
    router.push(`${target}?q=${encodeURIComponent(chipQuery)}`);
  }

  return (
    <section className="relative w-full bg-[#0d47a1]">
      <div className="relative w-full h-[220px] sm:h-[260px] md:h-[280px] overflow-hidden">
        {/* Blobs */}
        <div className="hero-blob h-72 w-72 bg-[#1976d2] top-0 -left-20 opacity-60" />
        <div className="hero-blob h-56 w-56 bg-[#42a5f5] top-4 right-0 opacity-30" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-5 sm:px-8">
          {/* Titre */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white whitespace-nowrap"
          >
            Trouvez,{" "}
            <span className="text-accent">Comparez</span>,{" "}
            Réservez.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-1.5 sm:mt-2 text-sm sm:text-base text-white/60"
          >
            Tout simplement.
          </motion.p>

          {/* Barre de recherche */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-4 sm:mt-5 flex w-full max-w-[520px] items-stretch gap-0"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Que cherchez-vous ?"
                className="h-[44px] sm:h-[48px] w-full border-0 bg-white pl-10 pr-14 text-xs sm:text-sm outline-none placeholder:text-slate-400 rounded-l-lg"
              />
              <VoiceButton
                onResult={(text) => setQuery(text)}
                className="!right-1 !h-8 !w-8"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-[44px] sm:h-[48px] items-center gap-1.5 rounded-r-lg bg-[#0a3a7d] border-2 border-white/30 px-4 sm:px-5 text-xs sm:text-sm font-semibold text-white hover:bg-[#1565c0] transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rechercher</span>
            </button>
          </motion.form>

          {/* Suggestions rapides — cliquables, avec icônes */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-3 flex items-center gap-2 flex-wrap justify-center"
          >
            {QUICK_CHIPS.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.query}
                  onClick={() => handleChipClick(chip.query)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${chip.color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {chip.label}
                </button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
