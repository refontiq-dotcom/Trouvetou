import type { Metadata } from "next";

/**
 * Metadata propre à /favoris.
 *
 * La page est un Client Component (contexte favoris), or `export const metadata`
 * est réservé aux Server Components. Le layout est donc le bon emplacement :
 * il reste local à la route et le système global n'est pas modifié.
 */
export const metadata: Metadata = {
  title: "Mes favoris",
  description:
    "Retrouvez les établissements que vous avez enregistrés sur Trouvetou, au même endroit et à tout moment.",
};

export default function FavorisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}