import { describe, expect, it } from "vitest";
import {
  BOOKABLE_CATEGORY_SLUGS,
  CATEGORIES,
  CATEGORY_SLUGS,
  NAVIGABLE_CATEGORY_SLUGS,
  PORTALS,
  categoryHref,
  categorySearchHref,
  getCategoryLabel,
  getCategoryPluralLabel,
  getPriceSuffix,
  isBookableCategory,
  portalPriceSuffix,
  portalTypeFilters,
} from "./categories";

/**
 * Le registre est la source de vérité unique des catégories : ces tests
 * verrouillent les propriétés qui rendaient les pages incohérentes
 * (libellés divergents, catégories invisibles, redirections vers le mauvais
 * portail).
 */
describe("Registre des catégories — unicité", () => {
  it("déclare chaque slug une seule fois", () => {
    expect(new Set(CATEGORY_SLUGS).size).toBe(CATEGORY_SLUGS.length);
  });

  it("donne un libellé distinct à chaque catégorie", () => {
    const singular = NAVIGABLE_CATEGORY_SLUGS.map((slug) => CATEGORIES[slug].label);
    const plural = NAVIGABLE_CATEGORY_SLUGS.map((slug) => CATEGORIES[slug].plural);

    expect(new Set(singular).size).toBe(singular.length);
    expect(new Set(plural).size).toBe(plural.length);
  });

  it("place chaque catégorie navigable dans un seul portail", () => {
    const seen = new Set<string>();

    for (const portal of Object.values(PORTALS)) {
      expect(new Set(portal.categories).size).toBe(portal.categories.length);

      for (const slug of portal.categories) {
        expect(seen.has(slug)).toBe(false);
        seen.add(slug);
        expect(CATEGORIES[slug].portal).toBe(portal.slug);
      }
    }

    expect([...seen].sort()).toEqual([...NAVIGABLE_CATEGORY_SLUGS].sort());
  });

  it("donne une URL distincte à chaque catégorie navigable", () => {
    const hrefs = NAVIGABLE_CATEGORY_SLUGS.map((slug) => categoryHref(slug));
    expect(new Set(hrefs).size).toBe(hrefs.length);

    expect(categoryHref("hotel")).toBe("/hotels?type=hotel");
    expect(categoryHref("residence")).toBe("/hotels?type=residence");
    expect(categoryHref("school")).toBe("/ecoles");
    expect(categoryHref("clinic")).toBe("/cliniques");
    expect(categoryHref("restaurant")).toBe("/restaurants");
  });

  it("n'expose pas la catégorie fourre-tout à la navigation", () => {
    expect(CATEGORIES.other.portal).toBeNull();
    expect(NAVIGABLE_CATEGORY_SLUGS).not.toContain("other");
    expect(categoryHref("other")).toBe("/");
  });

  it("facture les annonces d'un portail de la même façon", () => {
    for (const portal of Object.values(PORTALS)) {
      const suffixes = new Set(
        portal.categories.map((slug) => getPriceSuffix(slug))
      );
      expect(suffixes.size).toBe(1);
      expect(portalPriceSuffix(portal.slug)).toBe(
        getPriceSuffix(portal.categories[0])
      );
    }
  });

  it("n'expose un filtre de catégorie que sur les portails multi-catégories", () => {
    expect(portalTypeFilters("hotels")).toEqual(["hotel", "residence"]);
    expect(portalTypeFilters("ecoles")).toBeUndefined();
    expect(portalTypeFilters("cliniques")).toBeUndefined();
    expect(portalTypeFilters("restaurants")).toBeUndefined();
  });

  it("conserve la catégorie demandée dans le lien de partage", () => {
    expect(categorySearchHref("residence", "Studio GAGE")).toBe(
      "/hotels?type=residence&q=Studio+GAGE"
    );
    expect(categorySearchHref("school", "ECA")).toBe("/ecoles?q=ECA");
  });

  it("ne réserve en ligne que l'hôtellerie", () => {
    expect(BOOKABLE_CATEGORY_SLUGS).toEqual(["hotel", "residence"]);
    expect(isBookableCategory("hotel")).toBe(true);
    expect(isBookableCategory("residence")).toBe(true);
    expect(isBookableCategory("restaurant")).toBe(false);
    expect(isBookableCategory(null)).toBe(false);
  });

  it("expose les mêmes libellés partout", () => {
    expect(getCategoryLabel("residence")).toBe("Résidence");
    expect(getCategoryPluralLabel("residence")).toBe("Résidences");
    expect(getCategoryLabel("other")).toBe("Établissement");
  });
});
