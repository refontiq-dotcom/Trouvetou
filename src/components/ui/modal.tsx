"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Migration Phase 6B (couleurs) — valeurs strictement identiques :
//   --card #ffffff           -> --tt-card   #ffffff
//   --foreground #171c22     -> --tt-ink    #171c22
//   --muted-foreground #66717c -> --tt-ink-60 #66717c
//   --border #e7eaec         -> --tt-line   #e7eaec
//
// CONSERVÉS : `bg-slate-900/50` (overlay assombri, rôle propre — l'assombrissement
// standard d'une modale ; `--tt-dark` n'a pas d'équivalent « voile »), et
// `bg-muted` sur le survol des boutons de fermeture (pas d'équivalent tt-* exact).
//
// Deux AJOUTS d'accessibilité, signalés pour traçabilité (hors palette) :
//   - `type="button"` sur les deux boutons de fermeture : sans cela, un Modal
//     rendu dans un `<form>` déclenche une soumission au clic.
//   - `aria-hidden="true"` sur la croix : le nom accessible vient du
//     `aria-label="Fermer"` du bouton, la croix est décorative.
// Comportement, structure DOM, aria, clavier et animations : INCHANGÉS.

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus initial à l'ouverture
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Événements clavier (Tab et Escape)
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            // `outline-none` VOLONTAIRE : le dialogue reçoit le focus par programme
            // (`tabIndex={-1}`) afin de permettre la navigation clavier et la
            // lecture d'écran. Un contour autour de la modale serait parasite :
            // les éléments focusables à l'intérieur portent leur propre
            // indicateur via le focus global.
            className={cn(
              // Migration Phase 6B — `--card` #ffffff -> `--tt-card` #ffffff,
              // valeur identique. Le `outline-none` reste VOLONTAIRE (focus
              // programmatique sur `tabIndex={-1}`, cf. commentaire ligne 136).
              "relative w-full bg-tt-card rounded-2xl shadow-2xl max-h-[90vh] flex flex-col outline-none",
              sizeClasses[size]
            )}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {(title || description) && (
              <div className="p-6 border-b border-tt-line flex items-start justify-between shrink-0">
                <div>
                  {title && (
                    <h2 id={titleId} className="text-xl font-semibold text-tt-ink">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descriptionId} className="text-sm text-tt-ink-60 mt-1">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-tt-ink-60 hover:bg-muted transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            )}

            {!title && !description && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg text-tt-ink-60 hover:bg-muted transition-colors z-10"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}

            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
