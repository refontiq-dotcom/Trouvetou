import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          // Migration Phase 6B — valeurs identiques :
          //   --card #ffffff  -> --tt-card #ffffff
          //   --foreground #171c22 -> --tt-ink #171c22
          //   --muted-foreground #66717c -> --tt-ink-60 #66717c
          //   --border #e7eaec -> --tt-line #e7eaec
          //   --ring #171c22 -> --tt-ink #171c22
          // Dimensionnement (h-11, px-4, rounded-xl, text-sm) NON modifié.
          "h-11 w-full rounded-xl border bg-tt-card px-4 text-sm text-tt-ink placeholder:text-tt-ink-60",
          // `focus:outline-none` supprimé : le focus global `:focus-visible`
          // trace un contour encre 2px. On garde la bordure `focus:border-tt-ink`
          // (retour immédiat au clic) mais on bascule le ring sur
          // `focus-visible` pour éviter le double contour au clavier.
          "transition-all focus:border-tt-ink focus-visible:ring-2 focus-visible:ring-tt-ink",
          // `--destructive` est une couleur d'ÉTAT : sémantique préservée.
          error ? "border-destructive" : "border-tt-line",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
