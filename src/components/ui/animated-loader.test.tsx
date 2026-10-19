import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedLoader } from "./animated-loader";

/**
 * Garde-fous du loader officiel Trouvetou.
 *
 * Ce qui est verrouillé ici : le vrai symbole feuille + loupe (jamais le logo
 * horizontal ni une icône générique), l'anti-clignotement, l'absence de faux
 * pourcentage, le statut accessible, et la présence du bloc
 * `prefers-reduced-motion` qui coupe les animations.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AnimatedLoader — comportement", () => {
  it("ne montre rien avant le délai anti-clignotement, puis apparaît", () => {
    vi.useFakeTimers();
    const { container } = render(<AnimatedLoader delayMs={300} />);
    const scope = container.querySelector(".tt-loader-scope");

    expect(scope).not.toHaveClass("tt-loader-scope--visible");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(scope).not.toHaveClass("tt-loader-scope--visible");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(scope).toHaveClass("tt-loader-scope--visible");
  });

  it("s'affiche immédiatement avec delayMs = 0", () => {
    const { container } = render(<AnimatedLoader delayMs={0} />);
    expect(container.querySelector(".tt-loader-scope")).toHaveClass(
      "tt-loader-scope--visible"
    );
  });

  it("utilise le symbole officiel, pas le logo horizontal", () => {
    const { container } = render(<AnimatedLoader delayMs={0} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(
      "/brand/TrouveTout_symbole_transparent.png"
    );
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("reprend le symbole officiel à feuille blanche sur fond sombre", () => {
    const { container } = render(<AnimatedLoader delayMs={0} tone="dark" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/brand/TrouveTout_symbole_feuille_loupe.png"
    );
  });

  it("expose un statut accessible sans inventer de pourcentage", () => {
    render(<AnimatedLoader delayMs={0} label="Chargement en cours" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Chargement en cours")).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).not.toMatch(/\d+\s*%/);
  });
});

describe("AnimatedLoader — préférences de mouvement", () => {
  it("globals.css désactive les animations sous prefers-reduced-motion", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8"
    );
    const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start).toBeGreaterThan(-1);

    // Le bloc loader suit immédiatement la requête média dans globals.css.
    const block = css.slice(start, start + 700);
    expect(block).toContain(".tt-loader-scope");
    expect(block).toContain(".tt-loader-symbol");
    expect(block).toContain("animation: none");
  });
});
