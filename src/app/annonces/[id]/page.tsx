import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetail } from "@/components/listings/listing-detail";
import { fetchListingById } from "@/lib/supabase/listings";
import { toListingView } from "@/lib/supabase/listing-view";

interface PageProps { params: Promise<{ id: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListingById(id);
  if (!listing) return { title: "Annonce introuvable" };
  return {
    title: listing.title,
    description: listing.description ?? "Découvrez " + listing.title + " sur Trouvetou.",
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await fetchListingById(id);
  if (!listing) notFound();
  return <ListingDetail listing={toListingView(listing)} />;
}
