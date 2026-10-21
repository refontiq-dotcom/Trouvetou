"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "detail";
  /** Classes supplémentaires du panneau (largeur, hauteur…). */
  className?: string;
  /** Classes du conteneur de contenu (remplace le padding par défaut). */
  contentClassName?: string;
  /** Id du titre rendu par l'appelant quand `title` n'est pas fourni. */
  labelledBy?: string;
  /** Masque le bouton de fermeture interne (l'appelant en fournit un). */
  showClose?: boolean;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  /** Grande présentation desktop (galerie + informations). */
  detail: "max-w-[1400px] h-[88dvh]",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Seule la modale du dessus répond au clavier. Indispensable quand une modale
 * en ouvre une autre (ex. réservation depuis le détail d'une annonce) :
 * Échap ne doit fermer que la plus récente, et le piège de focus ne doit pas
 * ramener le focus dans la modale du dessous.
 */
function isTopmostDialog(dialog: HTMLElement): boolean {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"]'
  );
  return dialogs.length === 0 || dialogs[dialogs.length - 1] === dialog;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
  contentClassName,
  labelledBy,
  showClose = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Verrou de scroll : restaure la valeur précédente (et non « ») pour que
  // deux modales empilées ne déverrouillent pas la page prématurément.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
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
      const dialog = dialogRef.current;
      if (!dialog || !isTopmostDialog(dialog)) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;

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
            aria-labelledby={title ? titleId : labelledBy}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={cn(
              "relative w-full bg-card rounded-2xl shadow-2xl max-h-[90vh] flex flex-col outline-none",
              sizeClasses[size],
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {(title || description) && (
              <div className="p-6 border-b border-border flex items-start justify-between shrink-0">
                <div>
                  {title && (
                    <h2 id={titleId} className="text-xl font-semibold text-foreground">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descriptionId} className="text-sm text-muted-foreground mt-1">
                      {description}
                    </p>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {!title && !description && showClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors z-10"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div
              className={cn(
                "p-6 overflow-y-auto flex-1",
                contentClassName
              )}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
