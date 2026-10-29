"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
<<<<<<< HEAD
    if (!("serviceWorker" in navigator)) return;

    // En développement, le service worker n'a aucune utilité (le HMR de
    // Next.js gère déjà le rechargement à chaud) et provoque surtout des
    // bugs : son cache « cache-first » sur /_next/static/ peut resservir un
    // ancien bundle JS référençant des modules supprimés (ex. l'erreur
    // « ListingCard: href undefined »). On le DÉSENREGISTRE donc en dev.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

=======
    // En développement, un service worker en cache-first sert des chunks
    // périmés (et provoque des erreurs d'hydratation fantômes) : il n'est
    // enregistré qu'en production.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
>>>>>>> origin/main
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencieux : le service worker est optionnel
    });
  }, []);

  return null;
}
