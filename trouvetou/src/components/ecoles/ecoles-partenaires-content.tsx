"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CircleAlert, GraduationCap, MapPin, Search } from "lucide-react";
import { SchoolyEstablishmentCard } from "@/components/ecoles/schooly-establishment-card";
import type { SchoolyEstablishment } from "@/lib/schooly";
import type { EcolesPartenairesConfig } from "@/components/ecoles/config";

interface EcolesPartenairesContentProps {
  config: EcolesPartenairesConfig;
  ready: boolean;
  establishments: SchoolyEstablishment[];
  errorMessage: string | null;
  initialQuery: string;
}

export function EcolesPartenairesContent({
  config,
  ready,
  establishments,
  errorMessage,
  initialQuery = "",
}: EcolesPartenairesContentProps) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return establishments;
    const needle = query.trim().toLowerCase();
    return establishments.filter((est) => {
      const haystack = [
        est.name,
        est.city,
        est.address,
        est.school_type,
        est.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [establishments, query]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-sm text-muted-foreground hidden sm:block">
          Accueil <span className="mx-1">/</span>{" "}
          <span className="font-medium text-foreground">
            {config.breadcrumbLabel}
          </span>
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          <GraduationCap className="h-6 w-6 text-[#1769e8]" />
          {config.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {config.description}
        </p>
      </motion.div>

      <div className="sticky top-0 z-30 -mx-4 px-4 bg-white/95 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-3 border-b border-slate-100 mt-5">
        <div className="flex w-full items-stretch gap-0 rounded-xl bg-white shadow-sm border border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={config.searchPlaceholder}
              className="h-12 w-full border-0 bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {!ready ? (
          <NotConfigured />
        ) : errorMessage ? (
          <ErrorState message={errorMessage} />
        ) : filtered.length === 0 ? (
          <EmptyState message={config.emptyMessage} hasQuery={query.trim().length > 0} />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
              {filtered.length > 1 ? "écoles trouvées" : "école trouvée"}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((est, i) => (
                <SchoolyEstablishmentCard
                  key={est.id}
                  establishment={est}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 text-accent" />
        Catalogue synchronisé avec la plateforme Schooly.
      </p>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <CircleAlert className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        Intégration Schooly indisponible
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Le portail Écoles partenaires nécessite la configuration de{" "}
        <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">SCHOOLY_API_URL</code>{" "}
        et de la clé partagée. Veuillez réessayer plus tard.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <CircleAlert className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        📡 Problème de connexion avec Schooly
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyState({ message, hasQuery }: { message: string; hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <Search className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {hasQuery ? "🔍 Aucune école ne correspond" : "🏫 Catalogue vide"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
