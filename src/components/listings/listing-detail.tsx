"use client";

import Image from "next/image";
import { ArrowLeft, MapPin, Share2, Phone, MessageCircle } from "lucide-react";
import { useHeroTransition } from "@/contexts/hero-transition-context";
import type { ListingView } from "@/lib/supabase/listing-view";
import { buildWhatsAppUrl, formatFCFA, getCategoryLabel, PLACEHOLDER_IMAGE } from "@/lib/utils";

export function ListingDetail({ listing, priceSuffix = "par nuit" }: { listing: ListingView; priceSuffix?: string }) {
  const { closeListing } = useHeroTransition();
  const image = listing.images[0] ?? PLACEHOLDER_IMAGE;
  const establishment = listing.establishment;
  const contact = establishment.whatsapp ?? establishment.contact_phone;
  const whatsappUrl = contact
    ? buildWhatsAppUrl(contact, "Bonjour, je vous contacte depuis Trouvetou à propos de « " + listing.name + " ».", establishment.country)
    : null;

  async function share() {
    const data = { title: listing.name, text: "Découvrez " + listing.name + " sur Trouvetou.", url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(window.location.href);
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <section className="relative h-[360px] overflow-hidden bg-slate-200">
        <Image src={image} alt={listing.name} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/35" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button type="button" onClick={closeListing} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md" aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md" aria-label="Partager">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </section>

      <section className="-mt-8 relative mx-auto max-w-3xl rounded-t-[30px] bg-background px-5 pb-10 pt-6 shadow-[0_-8px_30px_rgba(0,0,0,.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {getCategoryLabel(listing.category_slug)}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{listing.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {establishment.city ?? "Localisation non précisée"}
              {establishment.address ? " · " + establishment.address : ""}
            </p>
          </div>
          {listing.price != null && (
            <div className="shrink-0 text-right">
              <p className="text-xl font-extrabold">{formatFCFA(listing.price)}</p>
              <p className="text-xs text-muted-foreground">{priceSuffix}</p>
            </div>
          )}
        </div>

        {listing.description && (
          <section className="mt-7">
            <h2 className="text-base font-bold">À propos</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{listing.description}</p>
          </section>
        )}

        {listing.amenities.length > 0 && (
          <section className="mt-7">
            <h2 className="text-base font-bold">Équipements</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {listing.amenities.map((amenity) => (
                <div key={amenity} className="rounded-2xl border bg-card px-3 py-3 text-sm">{amenity}</div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-base font-bold">Établissement</h2>
          <p className="mt-2 text-sm text-muted-foreground">{establishment.name}</p>
        </section>

        <div className="sticky bottom-4 mt-8 grid grid-cols-2 gap-2">
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-lg">
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </a>
          ) : null}
          {establishment.contact_phone ? (
            <a href={"tel:" + establishment.contact_phone} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-white shadow-lg">
              <Phone className="h-5 w-5" /> Appeler
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
