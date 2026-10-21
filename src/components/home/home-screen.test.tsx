import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "./home-screen";
import type { ListingView } from "@/lib/supabase/listing-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => "/",
}));

// `next/link` a besoin du contexte du routeur App : on le remplace par une
// simple ancre, sans effet sur le comportement testé ici.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

const toggleFavorite = vi.fn();
vi.mock("@/contexts/favorites-context", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite,
  }),
}));

// Le formulaire de réservation a ses propres tests.
vi.mock("@/components/hotels/booking-modal", () => ({
  BookingModal: () => null,
}));

const listing = (overrides: Partial<ListingView> = {}): ListingView => ({
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

function renderHome() {
  return render(
    <HomeScreen
      listings={[listing()]}
      categories={[{ slug: "hotel", label: "Hôtels", count: 1 }]}
      nearbyCount={1}
    />
  );
}

afterEach(() => {
  cleanup();
  toggleFavorite.mockClear();
});

describe("HomeScreen — ouverture du détail d'une annonce", () => {
  it("affiche la modale de détail au clic sur une carte", async () => {
    renderHome();

    // L'accueil rend deux grilles (desktop et mobile) : on vise la première.
    const [openButton] = screen.getAllByRole("button", {
      name: "Voir le détail de Studio — GAGE",
    });
    await userEvent.click(openButton);

    const dialog = await screen.findByRole("dialog", { name: "Studio — GAGE" });
    expect(dialog).toBeInTheDocument();
    // Le prix est vérifié dans la modale : la carte affiche aussi le sien.
    expect(within(dialog).getByText(/15\s*000\s*FCFA/)).toBeInTheDocument();
  });

  it("ferme la modale via la croix de fermeture", async () => {
    renderHome();

    const [openButton] = screen.getAllByRole("button", {
      name: "Voir le détail de Studio — GAGE",
    });
    await userEvent.click(openButton);
    await screen.findByRole("dialog", { name: "Studio — GAGE" });

    await userEvent.click(
      screen.getByRole("button", { name: "Fermer le détail de l'annonce" })
    );

    // La modale se retire après son animation de sortie.
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Studio — GAGE" })
      ).not.toBeInTheDocument()
    );
  });

  it("n'ouvre pas le détail au clic sur le bouton favori", async () => {
    renderHome();

    const [favoriteButton] = screen.getAllByRole("button", {
      name: "Ajouter aux favoris",
    });
    await userEvent.click(favoriteButton);

    expect(toggleFavorite).toHaveBeenCalledWith("l1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
