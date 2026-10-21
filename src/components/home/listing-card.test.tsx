import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListingCard } from "./listing-card";
import type { ListingView } from "@/lib/supabase/listing-view";

const toggleFavorite = vi.fn();
vi.mock("@/contexts/favorites-context", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite,
  }),
}));

const room = (overrides: Partial<ListingView> = {}): ListingView => ({
  id: "l1",
  external_id: "e1",
  name: "Studio — GAGE",
  price: 15000,
  images: ["https://cdn.example.com/photo-1.jpg"],
  description: "Un studio lumineux.",
  amenities: [],
  capacity: null,
  is_boosted: false,
  category_slug: "hotel",
  establishment: {
    id: "p1",
    name: "GAGE",
    type: "hotel",
    city: "Dakar",
    country: "SN",
    address: null,
    latitude: null,
    longitude: null,
    contact_phone: null,
    whatsapp: null,
    contact_email: null,
  },
  panoramas: [],
  updated_at: "2026-10-07T00:00:00.000Z",
  ...overrides,
});

afterEach(() => {
  cleanup();
  toggleFavorite.mockClear();
});

describe("ListingCard — accueil", () => {
  it("affiche la catégorie, la ville et le prix réel", () => {
    render(<ListingCard listing={room()} onOpen={() => {}} />);

    expect(screen.getByText("Hôtel")).toBeInTheDocument();
    expect(screen.getByText("Dakar")).toBeInTheDocument();
    expect(screen.getByText(/15\s*000\s*FCFA/)).toBeInTheDocument();
    expect(screen.getByText("par nuit")).toBeInTheDocument();
    expect(screen.getByText("Studio — GAGE")).toBeInTheDocument();
  });

  it("ouvre le détail de l'annonce au clic sur la carte", async () => {
    const onOpen = vi.fn();
    const listing = room();
    render(<ListingCard listing={listing} onOpen={onOpen} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Voir le détail de Studio — GAGE" })
    );
    expect(onOpen).toHaveBeenCalledWith(listing);
  });

  it("garde le bouton favori indépendant du clic d'ouverture", async () => {
    const onOpen = vi.fn();
    render(<ListingCard listing={room()} onOpen={onOpen} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Ajouter aux favoris" })
    );
    expect(toggleFavorite).toHaveBeenCalledWith("l1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("n'affiche pas de prix quand la donnée est absente", () => {
    render(<ListingCard listing={room({ price: null })} onOpen={() => {}} />);
    expect(screen.queryByText(/FCFA/)).not.toBeInTheDocument();
  });
});
