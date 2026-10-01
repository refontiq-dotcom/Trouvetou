import type { Metadata } from "next";

/**
 * Metadata propre à /compare.
 *
 * La page est un Client Component (`useSearchParams`), or `export const metadata`
 * est réservé aux Server Components. Le layout est donc le bon emplacement :
 * il reste local à la route et le système global n'est pas modifié.
 */
export const metadata: Metadata = {
  title: "Comparer des établissements",
  description:
    "Comparez deux établissements côte à côte : prix, ville, adresse, capacité et services.",
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}