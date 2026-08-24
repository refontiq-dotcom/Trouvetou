"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/ecoles?q=${encodeURIComponent(q)}` : "/ecoles");
  }

  return (
    <section className="relative overflow-hidden bg-[#0d47a1]">
      {/* Decorative blobs */}
      <div className="hero-blob h-96 w-96 bg-[#1976d2] top-0 -left-20 opacity-60" />
      <div className="hero-blob h-80 w-80 bg-[#42a5f5] top-10 right-0 opacity-30" />
      <div className="hero-blob h-64 w-64 bg-accent/30 bottom-0 left-1/3" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center">
        {/* Title — matching mockup font sizes */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[32px] sm:text-[44px] lg:text-[56px] font-extrabold tracking-tight text-white leading-[1.1]"
        >
          Trouvez,{" "}
          <span className="text-accent">Comparez</span>,
          <br className="sm:hidden" />{" "}
          Réservez.
        </motion.h1>

        {/* Subtitle — slightly smaller, lighter */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mx-auto mt-3 sm:mt-4 max-w-2xl text-base sm:text-lg text-white/60"
        >
          Tout simplement.
        </motion.p>

        {/* Search bar + Filtre — side by side, matching mockup */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mt-7 sm:mt-9 flex max-w-[540px] items-stretch gap-0"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ville, nom de l'école, niveau…"
              className="h-[52px] w-full rounded-l-xl border-0 bg-white pl-12 pr-4 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-[52px] items-center gap-2 rounded-r-xl bg-[#0a3a7d] border-2 border-white/30 px-5 sm:px-6 text-sm font-semibold text-white hover:bg-[#1565c0] transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtre
          </button>
        </motion.form>
      </div>
    </section>
  );
}
