"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, MapPin, User } from "lucide-react";
import { useLocation } from "@/contexts/location-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/pres-de-moi", label: "Près de moi", icon: MapPin },
  { href: "/profil", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { requestAutoLocation, loading } = useLocation();

  async function openNearby() {
    if (pathname === "/pres-de-moi") return;
    await requestAutoLocation();
    router.push("/pres-de-moi");
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur-xl safe-area-pb md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-3 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isNearby = item.href === "/pres-de-moi";
          const isActive = isNearby
            ? pathname === "/pres-de-moi"
            : item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-1 top-0 h-0.5 rounded-full bg-primary origin-center transition-transform duration-300 ease-out",
                  isActive ? "scale-x-100" : "scale-x-0"
                )}
              />
              <span
                className={cn(
                  "relative flex h-9 w-12 items-center justify-center rounded-2xl transition-all duration-300 ease-out",
                  isActive ? "bg-primary/10 -translate-y-0.5" : "bg-transparent"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform duration-300", isActive && "scale-110")} />
              </span>
              <span className={cn(
                "text-[10px] font-semibold transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {isNearby && loading ? "Localisation…" : item.label}
              </span>
            </>
          );

          if (isNearby) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={openNearby}
                disabled={loading}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl py-1 outline-none transition-all duration-300 active:scale-95 disabled:opacity-60"
                )}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl py-1 outline-none transition-all duration-300 active:scale-95"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
