"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { LocationBar } from "@/components/location/location-bar";
import { cn } from "@/lib/utils";

/**
 * Chrome desktop global (header + barre de position).
 *
 * Sur l'accueil, la barre dédiée `HomeHeader` — qui contient la recherche —
 * remplace le header global à partir de `lg`. En dessous (tablette), on
 * conserve le header global pour ne pas priver la page de navigation.
 */
export function DesktopChrome() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <>
      <div className={cn("hidden md:block", isHome && "lg:hidden")}>
        <Header />
      </div>
      {!isHome && (
        <div className="hidden md:block">
          <LocationBar />
        </div>
      )}
    </>
  );
}