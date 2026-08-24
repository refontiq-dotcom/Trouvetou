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

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white"
        >
          Trouvez,{" "}
          <span className="text-accent">Comparez</span>,{" "}
          Réservez.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mx-auto mt-3 sm:mt-4 max-w-2xl text-lg sm:text-xl text-white/70"
        >
          Tout simplement.
        </motion.p>

        {/* Search bar + Filtre */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mt-8 sm:mt-10 flex max-w-2xl items-center gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ville, nom de l'école, niveau…"
              className="h-14 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-sm outline-none shadow-lg shadow-black/10 placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-14 items-center gap-2 rounded-xl bg-[#0d47a1] border-2 border-white/20 px-6 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#1565c0] hover:shadow-xl"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtre
          </button>
        </motion.form>
      </div>
    </section>
  );
}
