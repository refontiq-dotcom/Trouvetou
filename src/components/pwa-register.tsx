"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    // En développement, un service worker en cache-first sert des chunks
    // périmés (et provoque des erreurs d'hydratation fantômes) : il n'est
    // enregistré qu'en production.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencieux : le service worker est optionnel
    });
  }, []);

  return null;
}
