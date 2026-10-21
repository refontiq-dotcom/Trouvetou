import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogContent } from "./catalog-content";
import { HOTELS_CONFIG } from "./configs";

const { fetchListedListings, fetchBoostedRooms, replace } = vi.hoisted(() => ({
  fetchListedListings: vi.fn(async () => ({ data: [], error: null })),
  fetchBoostedRooms: vi.fn(async () => ({ data: [], error: null })),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/hotels",
}));

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

vi.mock("@/lib/supabase/hotels", () => ({
  fetchListedListings: (params: unknown) => fetchListedListings(params),
  fetchBoostedRooms: (params: unknown) => fetchBoostedRooms(params),
  sortRooms: (rooms: unknown[]) => rooms,
}));

// Composants de présentation : ce test porte sur le filtre, pas sur le rendu.
vi.mock("@/components/hotels/room-card", () => ({ RoomCard: () => null }));
vi.mock("@/components/hotels/room-card-skeleton", () => ({
  RoomCardSkeletonGrid: () => null,
}));
vi.mock("@/components/hotels/boosted-carousel", () => ({
  BoostedCarousel: () => null,
}));
vi.mock("@/components/catalog/category-banner", () => ({
  CategoryBanner: () => null,
}));
vi.mock("@/components/catalog/filter-drawer", () => ({
  FilterDrawer: () => null,
}));
vi.mock("@/components/ui/voice-button", () => ({ VoiceButton: () => null }));
vi.mock("@/components/layout/back-link", () => ({ BackLink: () => null }));
vi.mock("@/contexts/location-context", () => ({
  useLocation: () => ({ location: null }),
}));

afterEach(() => {
  cleanup();
  fetchListedListings.mockClear();
  fetchBoostedRooms.mockClear();
  replace.mockClear();
});

describe("CatalogContent — filtre de catégorie", () => {
  it("charge la page filtrée sur la catégorie demandée", async () => {
    render(<CatalogContent config={HOTELS_CONFIG} initialType="residence" />);

    await waitFor(() => expect(fetchListedListings).toHaveBeenCalled());
    expect(fetchListedListings).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlugs: ["residence"] })
    );
  });

  it("affiche toutes les catégories du portail sans filtre", async () => {
    render(<CatalogContent config={HOTELS_CONFIG} />);

    await waitFor(() => expect(fetchListedListings).toHaveBeenCalled());
    expect(fetchListedListings).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlugs: ["hotel", "residence"] })
    );
  });

  it("ignore une catégorie inconnue", async () => {
    render(<CatalogContent config={HOTELS_CONFIG} initialType="inconnu" />);

    await waitFor(() => expect(fetchListedListings).toHaveBeenCalled());
    expect(fetchListedListings).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlugs: ["hotel", "residence"] })
    );
  });

  it("réécrit le filtre dans l'URL", async () => {
    render(<CatalogContent config={HOTELS_CONFIG} />);

    await userEvent.click(
      screen.getByRole("button", { name: "🏨Hôtel" })
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/hotels?type=hotel", {
        scroll: false,
      })
    );
  });

  it("retire la catégorie de l'URL quand on désactive le filtre", async () => {
    render(<CatalogContent config={HOTELS_CONFIG} initialType="residence" />);

    await userEvent.click(
      screen.getByRole("button", { name: "🏠Résidence" })
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/hotels", { scroll: false })
    );
  });
});
