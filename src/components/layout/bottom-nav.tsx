"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, User } from "lucide-react";
import { LocationPicker } from "@/components/location/location-picker";
import { cn } from "@/lib/utils";

/**
 * Navigation basse mobile — trois entrées principales (Accueil, À proximité,
 * Profil), conformément à la maquette validée.
 *
 * Les favoris ne sont pas supprimés du produit : ils sont accessibles depuis
 * l'en-tête et depuis la barre de proximité, et restent atteignables en desktop.
 */
const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "__autour__", label: "À proximité", icon: MapPin },
  { href: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/95 backdrop-blur-md safe-area-pb md:hidden"
      >
        <ul className="flex items-center justify-around px-2 py-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isAutour = item.href === "__autour__";
            const isActive = isAutour
              ? false
              : item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            if (isAutour) {
              return (
                <li key={item.href} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="tt-tap flex w-full flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-ink-60 transition-colors hover:bg-muted"
                  >
                    <Icon aria-hidden="true" className="h-6 w-6" />
                    <span className="text-[11px] font-medium">
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            }

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "tt-tap flex w-full flex-col items-center gap-0.5 rounded-xl px-2 py-1 transition-colors",
                    isActive
                      ? "bg-lime text-ink"
                      : "text-ink-60 hover:bg-muted"
                  )}
                >
                  <Icon aria-hidden="true" className="h-6 w-6" />
                  {/* L'état actif est porté par le fond lime ET par l'aria-current,
                      jamais par la couleur seule. */}
                  <span
                    className={cn(
                      "text-[11px]",
                      isActive ? "font-bold" : "font-medium"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}
