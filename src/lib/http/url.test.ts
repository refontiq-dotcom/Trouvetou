import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeHttpUrlList } from "./url";

describe("safeHttpUrl — schémas dangereux", () => {
  // Ces valeurs sont exactement ce qu'un provider compromis, ou un bug
  // d'ingestion, ferait pousser. Elles finiraient dans un attribut `src` ou
  // `href` chez le visiteur : les refuser est une barrière, pas une précaution.
  it.each([
    ["javascript:alert(1)", "javascript pur"],
    ["JavaScript:alert(1)", "javascript avec casse mixte"],
    ["  javascript:alert(1)  ", "javascript bordé d'espaces"],
    ["java\tscript:alert(1)", "javascript avec tabulation (contournement d'URL)"],
    ["vbscript:msgbox(1)", "vbscript"],
    ["data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "data: HTML encodé en base64"],
    ["data:text/html,<script>alert(1)</script>", "data: HTML en clair"],
  ])("refuse %s (%s)", (input) => {
    expect(safeHttpUrl(input)).toBeNull();
  });
});

describe("safeHttpUrl — schémas acceptés", () => {
  it("accepte une URL http", () => {
    expect(safeHttpUrl("http://cdn.example.test/photo.jpg")).toBe("http://cdn.example.test/photo.jpg");
  });

  it("accepte une URL https", () => {
    expect(safeHttpUrl("https://cdn.example.test/photo.jpg")).toBe("https://cdn.example.test/photo.jpg");
  });

  it("normalise le chemin et le schéma au lieu de conserver la chaîne brute", () => {
    // `new URL` normalise : le test vérifie qu'on stocke la forme canonique,
    // pas l'octet pour octet — deux écritures de la même ressource ne doivent
    // pas produire deux entrées de galerie.
    expect(safeHttpUrl("HTTPS://CDN.Example.Test/a/../photo.jpg")).toBe(
      "https://cdn.example.test/photo.jpg"
    );
  });

  it("accepte une URL avec port, query et fragment", () => {
    expect(safeHttpUrl("https://cdn.example.test:8443/p.jpg?w=800#top")).toBe(
      "https://cdn.example.test:8443/p.jpg?w=800#top"
    );
  });
});

describe("safeHttpUrl — valeurs inutilisables", () => {
  it.each([
    ["", "chaîne vide"],
    ["   ", "espaces seuls"],
    ["photo.jpg", "URL relative"],
    ["/uploads/photo.jpg", "URL absolue par chemin"],
    ["//cdn.example.test/photo.jpg", "URL protocol-relative"],
    ["http://", "schéma sans hôte"],
    ["https://", "https sans hôte"],
    ["not a url at all", "texte arbitraire"],
  ])("refuse %s (%s)", (input) => {
    expect(safeHttpUrl(input)).toBeNull();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["nombre", 42],
    ["objet", { url: "https://cdn.example.test/a.jpg" }],
    ["tableau", ["https://cdn.example.test/a.jpg"]],
    ["booléen", true],
  ])("refuse une valeur non textuelle (%s)", (_label, input) => {
    expect(safeHttpUrl(input)).toBeNull();
  });

  it("refuse une URL anormalement longue", () => {
    // Garde-fou : une valeur aberrante ne doit pas gonfler `attributes`.
    const huge = `https://cdn.example.test/${"a".repeat(4000)}.jpg`;
    expect(safeHttpUrl(huge)).toBeNull();
  });
});

describe("safeHttpUrlList", () => {
  it("retourne une liste vide si l'entrée n'est pas un tableau", () => {
    expect(safeHttpUrlList(undefined)).toEqual([]);
    expect(safeHttpUrlList("https://cdn.example.test/a.jpg")).toEqual([]);
    expect(safeHttpUrlList({ 0: "https://cdn.example.test/a.jpg" })).toEqual([]);
  });

  it("conserve l'ordre d'origine", () => {
    const result = safeHttpUrlList([
      "https://cdn.example.test/c.jpg",
      "https://cdn.example.test/a.jpg",
      "https://cdn.example.test/b.jpg",
    ]);
    expect(result).toEqual([
      "https://cdn.example.test/c.jpg",
      "https://cdn.example.test/a.jpg",
      "https://cdn.example.test/b.jpg",
    ]);
  });

  it("déduplique, y compris les variantes normalisées d'une même ressource", () => {
    const result = safeHttpUrlList([
      "https://cdn.example.test/a.jpg",
      "https://cdn.example.test/a.jpg",
      "HTTPS://CDN.EXAMPLE.TEST/a.jpg",
    ]);
    expect(result).toEqual(["https://cdn.example.test/a.jpg"]);
  });

  it("ignore silencieusement les entrées invalides sans les faire échouer", () => {
    // Une photo cassée ne doit pas faire disparaître l'annonce entière.
    const result = safeHttpUrlList([
      "https://cdn.example.test/ok.jpg",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "relative.jpg",
      "https://cdn.example.test/ok2.jpg",
    ]);
    expect(result).toEqual([
      "https://cdn.example.test/ok.jpg",
      "https://cdn.example.test/ok2.jpg",
    ]);
  });
});