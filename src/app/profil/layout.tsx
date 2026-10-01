import type { Metadata } from "next";

/**
 * Metadata propre à /profil.
 *
 * La page est un Client Component (contextes favoris / réservations), or
 * `export const metadata` est réservé aux Server Components. Le layout est
 * donc le bon emplacement : il est server par défaut et reste local à la
 * route — le système global de metadata n'est pas touché.
 */
export const metadata: Metadata = {
  title: "Mon profil",
  description:
    "Gérez vos favoris, vos réservations, votre position et vos alertes d'annonces au même endroit.",
};

export default function ProfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}