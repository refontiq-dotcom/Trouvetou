import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ListingDetailModal } from "./listing-detail-modal";
import type { ListingView } from "@/lib/supabase/listing-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => "/",
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/contexts/favorites-context", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: () => {},
  }),
}));

// Le formulaire de réservation a ses propres tests : ici on vérifie le détail.
vi.mock("@/components/hotels/booking-modal", () => ({
  BookingModal: () => null,
}));

const room = (overrides: Partial<ListingView> = {}): ListingView => ({
  id: "l1",
  external_id: "e1",
  name: "Studio — GAGE",
  price: 15000,
  images: [
    "https://cdn.example.com/photo-1.jpg",
    "https://cdn.example.com/photo-2.jpg",
  ],
  description: "Un studio lumineux au cœur du Plateau.",
  amenities: ["wifi"],
  capacity: null,
  is_boosted: false,
  category_slug: "hotel",
  establishment: {
    id: "p1",
    name: "GAGE",
    type: "hotel",
    city: "Dakar",
    country: "SN",
    address: "Plateau",
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
});

describe("ListingDetailModal — contenu", () => {
  it("affiche l'annonce ouverte, sa catégorie, sa localisation et son prix", () => {
    render(<ListingDetailModal room={room()} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Studio — GAGE" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Hôtel")).toBeInTheDocument();
    expect(screen.getByText(/Dakar/)).toBeInTheDocument();
    expect(screen.getByText(/15\s*000\s*FCFA/)).toBeInTheDocument();
    expect(
      screen.getByText("Un studio lumineux au cœur du Plateau.")
    ).toBeInTheDocument();
    expect(screen.getByText("Publié par GAGE")).toBeInTheDocument();
  });

  it("propose les actions déjà prises en charge", () => {
    render(<ListingDetailModal room={room()} onClose={() => {}} />);

    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me")
    );
    expect(
      screen.getByRole("button", { name: /Itinéraire/ })
    ).toBeInTheDocument();
    // Hôtel : la réservation en ligne est disponible.
    expect(
      screen.getByRole("button", { name: /Réserver/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ajouter aux favoris" })
    ).toBeInTheDocument();
  });

  it("ne rend rien sans annonce sélectionnée", () => {
    render(<ListingDetailModal room={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ListingDetailModal — galerie", () => {
  it("affiche la première photo puis permet de naviguer", () => {
    render(<ListingDetailModal room={room()} onClose={() => {}} />);

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(
      screen.getByAltText("Studio — GAGE — photo 1 sur 2")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Photo suivante" }));

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(
      screen.getByAltText("Studio — GAGE — photo 2 sur 2")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Afficher la photo 1" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("gère une annonce sans photo avec l'illustration de repli", () => {
    render(
      <ListingDetailModal room={room({ images: [] })} onClose={() => {}} />
    );

    const image = screen.getByAltText("Studio — GAGE — photo 1 sur 1");
    expect(image.getAttribute("src")).toContain("placeholder-hotel.svg");
    expect(
      screen.queryByRole("button", { name: "Photo suivante" })
    ).not.toBeInTheDocument();
  });
});

describe("ListingDetailModal — fermeture", () => {
  it("appelle onClose avec la touche Échap", () => {
    const onClose = vi.fn();
    render(<ListingDetailModal room={room()} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose au clic sur l'arrière-plan", () => {
    const onClose = vi.fn();
    render(<ListingDetailModal room={room()} onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Studio — GAGE" });
    const backdrop = dialog.previousElementSibling as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose via le bouton de fermeture", () => {
    const onClose = vi.fn();
    render(<ListingDetailModal room={room()} onClose={onClose} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Fermer le détail de l'annonce" })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
