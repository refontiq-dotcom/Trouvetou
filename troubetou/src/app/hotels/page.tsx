import type { Metadata } from "next";
import { HotelsContent } from "@/components/hotels/hotels-content";

export const metadata: Metadata = {
  title: "Hôtels & Résidences Meublées",
  description:
    "Parcourez les chambres, studios et appartements meublés disponibles à la nuit, à la semaine ou au mois, publiés par nos établissements partenaires.",
};

interface HotelsPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return <HotelsContent initialQuery={initialQuery} />;
}
