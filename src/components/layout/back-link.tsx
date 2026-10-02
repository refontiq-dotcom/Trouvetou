import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  /** Destination du retour (l'accueil par défaut). */
  href?: string;
  /** Libellé du lien. */
  label?: string;
}

/**
 * Lien de retour vers l'accueil.
 *
 * Sur desktop, le header global et le fil d'Ariane cliquable suffisent :
 * ce lien est donc masqué (`md:hidden`) et réservé au mobile, où le
 * header global n'existe pas.
 */
export function BackLink({ href = "/", label = "Accueil" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:hidden"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}