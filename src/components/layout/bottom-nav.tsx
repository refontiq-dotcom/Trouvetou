"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, User } from "lucide-react";
import { LocationPicker } from "@/components/location/location-picker";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "__autour__", label: "Près de moi", icon: MapPin },
  { href: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur-md safe-area-pb md:hidden">
        <div className="grid grid-cols-3 items-center px-3 py-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isAutour = item.href === "__autour__";
            const isActive = isAutour ? false : item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            if (isAutour) {
              return (
                <button key={item.href} onClick={() => setPickerOpen(true)} className="relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors" aria-label="Près de moi">
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Près de moi</span>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={cn("relative flex min-h-12 flex-col items-center justify-center gap-0.5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} />
                <span className={cn("text-[10px] font-medium", isActive && "text-primary")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}
