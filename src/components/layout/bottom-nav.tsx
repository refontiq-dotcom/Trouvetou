"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, MapPin, User } from "lucide-react";
import { LocationPicker } from "@/components/location/location-picker";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "__autour__", label: "À proximité", icon: MapPin },
  { href: "/favoris", label: "Favoris", icon: Heart },
  { href: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur-md safe-area-pb md:hidden">
        <div className="flex items-center justify-around px-2 py-1.5">
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
                <button
                  key={item.href}
                  onClick={() => setPickerOpen(true)}
                  className="relative flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] transition-colors text-muted-foreground"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">À proximité</span>
                  <span className="h-0.5 w-8 rounded-full bg-transparent" />
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] transition-colors",
                  isActive ? "text-lime" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "fill-lime/15")} />
                <span className={cn("text-[10px] font-semibold", isActive && "text-lime")}>
                  {item.label}
                </span>
                {/* Souligné de l'item actif (maquette) */}
                <span
                  className={cn(
                    "h-0.5 w-8 rounded-full transition-colors",
                    isActive ? "bg-lime" : "bg-transparent"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </nav>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}
