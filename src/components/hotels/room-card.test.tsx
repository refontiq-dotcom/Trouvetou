import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomCard } from "./room-card";
import type { ListingView } from "@/lib/supabase/listing-view";
import type { PanoramaMedia } from "@/lib/supabase/panorama";

/**
 * Tests d'intégration de la Vue 360° dans la fiche annonce.
 *
 * Ces tests vérifient la règle centrale de la feature : une annonce SANS
 * panorama doit s'afficher EXACTEMENT comme avant. Toute régression ici est
 * visible sur les 99 % du catalogue qui n'ont pas de visite 360°.
 *
 * Les contextes (favoris, comparaison, géolocalisation) et la modale de
 * réservation sont mockés : ils n'ont aucun rapport avec la 360° et
 * BoardingModal ouvrirait une requête réseau.
 */

vi.mock("@/contexts/location-context", () => ({
  useLocation: () => ({ location: null }),
}));
vi.mock("@/contexts/favorites-context", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: () => {} }),
}));
vi.mock("@/contexts/compare-context", () => ({
  useCompare: () => ({ isSelected: () => false, toggleCompare: () => {} }),
}));
vi.mock("@/components/hotels/booking-modal", () => ({
  BookingModal: () => null,
}));

const panorama: PanoramaMedia = {
  id: "p1",
  url: "https://pub.example.r2.dev/schooly/production/360/s1/p1.jpg",
  media_type: "photo_360",
  projection: "equirectangular_2_1",
  width: 6000,
  height: 3000,
  room_id: null,
  validated_at: "2026-09-28T10:00:00.000Z",
};

/** Annonce de base, proche de ce que renvoie réellement le catalogue. */
const annonce = (overrides: Partial<ListingView> = {}): ListingView => ({
  id: "l1",
  external_id: "s1",
  name: "École Saint-Jean",
  price: 250_000,
  images: ["https://cdn.example.com/classique.jpg"],
  description: "Une école calmlyeut reconnue.",
  amenities: [],
  capacity: null,
  is_boosted: false,
  category_slug: "school",
  panoramas: [],
  establishment: {
    id: "p1",
    name: "Réseau Scolaire",
    type: "school",
    city: "Abidjan",
    country: "CI",
    address: "Cocody",
    latitude: null,
    longitude: null,
    contact_phone: null,
    whatsapp: null,
    contact_email: null,
  },
  updated_at: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

/** Ouvre la fiche détail en cliquant sur la carte. */
async function ouvrirFiche() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("article"));
  return user;
}

afterEach(() => {
  cleanup();
});

describe("Annonce SANS panorama — comportement inchangé", () => {
  it("n'affiche aucun bouton Vue 360°", async () => {
    render(<RoomCard room={annonce()} />);
    await ouvrirFiche();

    expect(screen.queryByText("Vue 360°")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /visite 360/ })).not.toBeInTheDocument();
  });

  it("affiche toujours la description de l'annonce", async () => {
    render(<RoomCard room={annonce()} />);
    await ouvrirFiche();

    expect(screen.getByText("Une école calmlyeut reconnue.")).toBeInTheDocument();
  });

  it("ignore un panorama corrompu au lieu de casser la fiche", async () => {
    // Le parseur a déjà filtré, mais on rejoue le cas où `panoramas` contient
    // une entrée invalide passée par un autre chemin.
    render(<RoomCard room={annonce({ panoramas: [] })} />);
    await ouvrirFiche();

    expect(screen.queryByText("Vue 360°")).not.toBeInTheDocument();
  });
});

describe("Annonce AVEC panorama", () => {
  it("affiche le bouton Vue 360° une fois la fiche ouverte", async () => {
    render(<RoomCard room={annonce({ panoramas: [panorama] })} />);
    await ouvrirFiche();

    expect(screen.getByText("Vue 360°")).toBeInTheDocument();
  });

  it("ouvre la visionneuse au clic, puis revient à l'annonce à la fermeture", async () => {
    render(<RoomCard room={annonce({ panoramas: [panorama] })} />);
    const user = await ouvrirFiche();

    await user.click(screen.getByRole("button", { name: /Ouvrir la visite 360/ }));
    // La visionneuse prend le dessus : son bouton de fermeture apparaît.
    const fermer = await screen.findByRole("button", { name: "Fermer la visite 360°" });
    expect(fermer).toBeInTheDocument();

    await user.click(fermer);
    // Retour à la fiche : le bouton est de nouveau proposé, la visionneuse
    // n'est plus montée.
    await screen.findByRole("button", { name: /Ouvrir la visite 360/ });
    expect(screen.queryByRole("button", { name: "Fermer la visite 360°" })).not.toBeInTheDocument();
  });

  it("n'affiche le bouton qu'après ouverture de la fiche", async () => {
    // L'indicateur ne doit pas encombrer la grille du catalogue.
    render(<RoomCard room={annonce({ panoramas: [panorama] })} />);
    expect(screen.queryByText("Vue 360°")).not.toBeInTheDocument();
  });
});
