"use client";

import { useEffect, useState } from "react";

/**
 * Splash PWA reproduisant la maquette de marque :
 * fond crème, logo horizontal (variante sombre), mention REFONTIQ en pied.
 * Affiché uniquement en mode applicatif installé (standalone / iOS standalone),
 * il s'efface tout seul dès que l'app a peint (sessionStorage par navigation
 * pour ne pas re-pulser à chaque chargement interne).
 */
export function PwaSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Décision reportée d'un tick : évite un setState synchrone dans
    // l'effet (cascading renders) tout en restant invisible à l'œil.
    const show = requestAnimationFrame(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // iOS n'expose pas display-mode dans tous les cas
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      if (!standalone) return;
      if (sessionStorage.getItem("pwa-splash-shown")) return;
      sessionStorage.setItem("pwa-splash-shown", "1");
      setVisible(true);
    });

    // Durée minimale de 900 ms : le temps que le premier écran soit prêt.
    const t = setTimeout(() => setVisible(false), 900);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(t);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pwa-splash"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F3EC",
      }}
    >
      <img
        src="/brand/TrouveTout_logo_sombre_transparent.png"
        alt=""
        style={{ width: "min(72vw, 340px)", height: "auto" }}
      />
      <span
        style={{
          position: "fixed",
          bottom: "max(28px, env(safe-area-inset-bottom, 0px) + 20px)",
          fontSize: 13,
          letterSpacing: "0.22em",
          color: "#9AA0A6",
          fontWeight: 600,
        }}
      >
        REFONTIQ
      </span>
    </div>
  );
}
