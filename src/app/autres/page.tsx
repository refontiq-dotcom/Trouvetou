import type { Metadata } from "next";
import { CatalogContent } from "@/components/catalog/catalog-content";
import { AUTRES_CONFIG } from "@/components/catalog/configs";

export const metadata: Metadata = {
  title: "Autres annonces",
  description: "Découvrez les autres établissements et services référencés sur TrouveTout.",
};

export default function AutresPage() {
  return <CatalogContent config={AUTRES_CONFIG} />;
}
