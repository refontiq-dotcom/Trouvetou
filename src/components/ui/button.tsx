import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Migration Phase 6B — tokens de marque TrouveTout, valeurs strictement
// identiques aux tokens legacy remplacés :
//   --primary          #171c22  -> --tt-ink     #171c22
//   --primary-hover    #11161d  -> --tt-ink-80  #11161d
//   --primary-foreground #ffffff -> blanc       #ffffff
//   --foreground       #171c22  -> --tt-ink     #171c22
//   --card             #ffffff  -> --tt-card    #ffffff
//   --border           #e7eaec  -> --tt-line    #e7eaec
//   --ring             #171c22  -> --tt-ink     #171c22
//
// CONSERVÉS volontairement :
//   --secondary / --secondary-foreground : pas d'équivalent tt-* exact.
//   --muted   #f0f2f3 : PAS d'équivalent tt-* exact (ni --tt-surface #f7f8f8,
//                       ni --tt-lime-soft #f0f9d1 ne correspondent). Un token
//                       ne doit pas être inventé ici.
//   --muted-foreground #66717c -> --tt-ink-60 #66717c : rôle de texte
//                       secondaire identique, valeur identique.
//   --destructive : couleur d'ÉTAT fonctionnel, sémantique préservée.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-tt-ink text-white hover:bg-tt-ink-80 shadow-sm hover:shadow-md",
  secondary:
    "bg-secondary text-secondary-foreground hover:brightness-95",
  outline:
    "border border-tt-line bg-tt-card text-tt-ink hover:bg-muted",
  ghost: "text-tt-ink-60 hover:bg-muted hover:text-tt-ink",
  destructive: "bg-destructive text-white hover:opacity-90 shadow-sm",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  icon: "h-10 w-10 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = "", variant = "primary", size = "md", loading, children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // `--ring` #171c22 -> `--tt-ink` #171c22 : valeur identique. Le mécanisme
          // Phase 5 est INTACT : `focus-visible` reste le déclencheur, le ring
          // et son offset 2px aussi. Seul le nom du token change.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-ink focus-visible:ring-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
