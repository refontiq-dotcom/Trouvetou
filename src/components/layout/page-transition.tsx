"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ORDER = ["/", "/pres-de-moi", "/profil"];

function getNavIndex(pathname: string) {
  const index = NAV_ORDER.findIndex((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
  return index;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const index = getNavIndex(pathname);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.997 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-full"
        data-nav-view={index >= 0 ? NAV_ORDER[index] : "other"}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
