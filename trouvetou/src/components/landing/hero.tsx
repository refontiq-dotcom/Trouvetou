"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { detectTargetPortal } from "@/lib/search-intent";
import { VoiceButton } from "@/components/ui/voice-button";

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const target = q ? detectTargetPortal(q)?.targetHref ?? "/ecoles" : "/ecoles";
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target);
  }

  return (
    <section className="relative w-full bg-[#0d47a1]">
      {/* Hauteur augmentée — pleine largeur edge-to-edge */}
      <div className="relative w-full h-[220px] sm:h-[260px] md:h-[280px] overflow-hidden">
        {/* Blobs décoratifs */}
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

          {/* Sous-titre */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-1.5 sm:mt-2 text-sm sm:text-base text-white/60"
          >
            Tout simplement.
          </motion.p>

          {/* Barre de recherche — plus large */}
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
                placeholder="Ville, établissement, spécialité…"
                className="h-[44px] sm:h-[48px] w-full border-0 bg-white pl-10 pr-12 text-xs sm:text-sm outline-none placeholder:text-slate-400"
              />
              <VoiceButton
                onResult={(text) => setQuery(text)}
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 text-slate-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-[44px] sm:h-[48px] items-center gap-1.5 rounded-r-lg bg-[#0a3a7d] border-2 border-white/30 px-4 sm:px-5 text-xs sm:text-sm font-semibold text-white hover:bg-[#1565c0] transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtre
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
