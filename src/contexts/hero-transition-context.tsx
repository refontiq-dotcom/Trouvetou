"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ListingView } from "@/lib/supabase/listing-view";

type RectLike = { left: number; top: number; width: number; height: number; borderRadius: number };
type HeroStatus = "idle" | "opening" | "open" | "closing";
interface HeroTransitionContextValue { status: HeroStatus; selectedListing: ListingView | null; openListing: (listing: ListingView, source: HTMLElement) => void; closeListing: () => void; }
const HeroTransitionContext = createContext<HeroTransitionContextValue | null>(null);

function readRect(element: HTMLElement): RectLike {
  const rect = element.getBoundingClientRect();
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 16;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: radius };
}

export function HeroTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<HeroStatus>("idle");
  const [selectedListing, setSelectedListing] = useState<ListingView | null>(null);
  const [sourceRect, setSourceRect] = useState<RectLike | null>(null);
  const [sourceScrollY, setSourceScrollY] = useState(0);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const openedFromCatalog = useRef(false);

  const openListing = useCallback((listing: ListingView, source: HTMLElement) => {
    if (status !== "idle") return;
    const image = source.querySelector<HTMLElement>("[data-hero-source-image]") ?? source;
    setSelectedListing(listing);
    setSourceRect(readRect(image));
    setSourceScrollY(window.scrollY);
    setTargetPath("/annonces/" + encodeURIComponent(listing.id));
    openedFromCatalog.current = true;
    setStatus("opening");
  }, [status]);

  const closeListing = useCallback(() => {
    if (!selectedListing || status === "closing") return;
    setStatus("closing");
    router.back();
  }, [router, selectedListing, status]);

  useEffect(() => {
    if (status !== "opening" || !targetPath) return;
    const timer = window.setTimeout(() => router.push(targetPath), 420);
    return () => window.clearTimeout(timer);
  }, [status, targetPath, router]);

  useEffect(() => {
    if (!openedFromCatalog.current || !selectedListing) return;
    const detailPath = "/annonces/" + selectedListing.id;
    if (status === "opening" && pathname === detailPath) {
      const timer = window.setTimeout(() => setStatus("open"), 100);
      return () => window.clearTimeout(timer);
    }
    if (status === "closing" && pathname !== detailPath) {
      const timer = window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>("[data-listing-id=\"" + CSS.escape(selectedListing.id) + "\"]");
        if (target) {
          const image = target.querySelector<HTMLElement>("[data-hero-source-image]") ?? target;
          setSourceRect(readRect(image));
          window.scrollTo({ top: sourceScrollY, behavior: "auto" });
        }
        window.setTimeout(() => {
          setStatus("idle"); setSelectedListing(null); setTargetPath(null); openedFromCatalog.current = false;
        }, 420);
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [pathname, selectedListing, sourceScrollY, status]);

  const shouldShow = selectedListing && status !== "idle";
  return (
    <HeroTransitionContext.Provider value={{ status, selectedListing, openListing, closeListing }}>
      {children}
      {shouldShow && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" data-hero-transition>
          <div
            className="absolute overflow-hidden shadow-2xl transition-[left,top,width,height,border-radius,opacity] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{
              left: status === "opening" || status === "closing" ? sourceRect?.left ?? 0 : 0,
              top: status === "opening" || status === "closing" ? sourceRect?.top ?? 0 : 0,
              width: status === "opening" || status === "closing" ? sourceRect?.width ?? 0 : "100%",
              height: status === "opening" || status === "closing" ? sourceRect?.height ?? 0 : "360px",
              borderRadius: status === "opening" || status === "closing" ? sourceRect?.borderRadius ?? 16 : 0,
              backgroundImage: selectedListing.images[0] ? "url(\"" + selectedListing.images[0] + "\")" : undefined,
              backgroundPosition: "center", backgroundSize: "cover",
              opacity: status === "open" ? 0 : 1,
            }}
          />
          <div className={"absolute inset-x-0 bottom-0 rounded-t-[30px] bg-background shadow-[0_-20px_60px_rgba(0,0,0,.16)] transition-transform duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] " + (status === "opening" || status === "closing" ? "translate-y-full" : "translate-y-0")} style={{ height: "calc(100% - 300px)" }} />
        </div>
      )}
    </HeroTransitionContext.Provider>
  );
}

export function useHeroTransition() {
  const context = useContext(HeroTransitionContext);
  if (!context) throw new Error("useHeroTransition must be used inside HeroTransitionProvider");
  return context;
}