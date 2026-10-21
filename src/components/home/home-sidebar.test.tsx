import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HomeSidebar } from "./home-sidebar";

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

const categories = [
  { slug: "hotel", label: "Hôtels", count: 12 },
  { slug: "residence", label: "Résidences", count: 3 },
  { slug: "school", label: "Écoles", count: 5 },
  { slug: "clinic", label: "Cliniques", count: 1 },
  { slug: "restaurant", label: "Restaurants", count: 0 },
];

afterEach(() => {
  cleanup();
});

describe("HomeSidebar — navigation par catégorie", () => {
  it("lie chaque catégorie à la page de cette catégorie", () => {
    render(<HomeSidebar categories={categories} />);

    expect(screen.getByRole("link", { name: /Hôtels/ })).toHaveAttribute(
      "href",
      "/hotels?type=hotel"
    );
    expect(screen.getByRole("link", { name: /Résidences/ })).toHaveAttribute(
      "href",
      "/hotels?type=residence"
    );
    expect(screen.getByRole("link", { name: /Écoles/ })).toHaveAttribute(
      "href",
      "/ecoles"
    );
    expect(screen.getByRole("link", { name: /Cliniques/ })).toHaveAttribute(
      "href",
      "/cliniques"
    );
    expect(screen.getByRole("link", { name: /Restaurants/ })).toHaveAttribute(
      "href",
      "/restaurants"
    );
  });

  it("affiche le nombre d'annonces de chaque catégorie", () => {
    render(<HomeSidebar categories={categories} />);

    expect(screen.getByRole("link", { name: /Hôtels/ })).toHaveTextContent(
      "12"
    );
    expect(screen.getByRole("link", { name: /Résidences/ })).toHaveTextContent(
      "3"
    );
  });

  it("n'affiche que les catégories proposées", () => {
    render(<HomeSidebar categories={categories} />);

    expect(screen.getAllByRole("link")).toHaveLength(categories.length);
  });
});
