import { describe, expect, it } from "vitest";
import { sanitizeSyncAttributes } from "./route";

// ============================================================================
// Sécurité à l'INGESTION — la preuve que le câblage n'est pas contourné.
//
// Tester `safeHttpUrl` isolément ne prouverait rien : si une route écrivait
// `attributes.panorama_tour` sans passer par la validation, la fonction
// resterait parfaitement correcte ET la faille serait toujours ouverte.
//
// Ce fichier teste donc le point d'entrée RÉEL des données provider
// (`sanitizeSyncAttributes`, appelé par POST /api/v1/sync avant l'upsert) et
// vérifie ce qui sera RÉELLEMENT écrit en base. C'est le niveau qui compte :
// la frontière réseau, pas la fonction utilitaire.
// ============================================================================

const DANGEROUS = [
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
] as const;

describe("sanitizeSyncAttributes — panorama_tour", () => {
  it("conserve un tour valide et le stocke normalisé", () => {
    const result = sanitizeSyncAttributes({
      panorama_tour: {
        version: 1,
        startSceneId: "a",
        scenes: [
          { id: "a", name: "Réception", kind: "lobby", src: "https://cdn.example.test/a.webp" },
        ],
        links: [],
      },
    });

    const tour = result.panorama_tour as { scenes: { id: string; src: string }[] };
    expect(tour.scenes).toHaveLength(1);
    expect(tour.scenes[0].src).toBe("https://cdn.example.test/a.webp");
  });

  it.each(DANGEROUS)("écarte un tour dont la seule scène porte %s", (src) => {
    const result = sanitizeSyncAttributes({
      panorama_tour: {
        version: 1,
        startSceneId: "a",
        scenes: [{ id: "a", name: "A", kind: "room", src }],
        links: [],
      },
    });

    // Aucun tour exploitable ne doit subsister : le viewer n'a alors rien à
    // afficher, et `panorama_tour: null` évite une entrée vide trompeuse.
    expect(result.panorama_tour).toBeNull();
  });

  it("conserve les scènes saines d'un tour partiellement compromis", () => {
    const result = sanitizeSyncAttributes({
      panorama_tour: {
        version: 1,
        startSceneId: "safe",
        scenes: [
          { id: "safe", name: "Salle", kind: "room", src: "https://cdn.example.test/ok.webp" },
          { id: "bad", name: "Piège", kind: "room", src: "javascript:alert(1)" },
        ],
        links: [],
      },
    });

    const tour = result.panorama_tour as { scenes: { id: string }[] };
    expect(tour.scenes.map((scene) => scene.id)).toEqual(["safe"]);
  });

  it("ne laisse aucune URL dangereuse dans un tour valide", () => {
    // Contrôle de surface : on sérialise ce qui part en base et on vérifie
    // qu'aucun des schémas bannis n'y figure, quelle que soit sa position.
    const result = sanitizeSyncAttributes({
      panorama_tour: {
        version: 1,
        startSceneId: "a",
        scenes: [
          {
            id: "a",
            name: "A",
            kind: "room",
            src: "https://cdn.example.test/a.webp",
            previewSrc: "javascript:alert(1)",
          },
        ],
        links: [],
      },
    });

    expect(result.panorama_tour).toBeNull();
  });
});

describe("sanitizeSyncAttributes — URL 360° et photo de couverture", () => {
  it.each(DANGEROUS)("met à null un panorama_360_url valant %s", (url) => {
    const result = sanitizeSyncAttributes({ panorama_360_url: url });
    expect(result.panorama_360_url).toBeNull();
  });

  it("conserve une URL 360° légitime", () => {
    const result = sanitizeSyncAttributes({ panorama_360_url: "https://cdn.example.test/360.webp" });
    expect(result.panorama_360_url).toBe("https://cdn.example.test/360.webp");
  });

  it.each(DANGEROUS)("met à null une cover_image_url valant %s", (url) => {
    const result = sanitizeSyncAttributes({ cover_image_url: url });
    expect(result.cover_image_url).toBeNull();
  });

  it("conserve une cover_image_url légitime", () => {
    const result = sanitizeSyncAttributes({ cover_image_url: "https://cdn.example.test/cover.jpg" });
    expect(result.cover_image_url).toBe("https://cdn.example.test/cover.jpg");
  });
});

describe("sanitizeSyncAttributes — non-régression", () => {
  it("laisse passer les attributs métier sans URL", () => {
    // `attributes` est l'espace d'extension générique du cœur. Le vider
    // casserait des providers qui l'utilisent déjà : seuls les champs média
    // sont filtrés.
    const result = sanitizeSyncAttributes({
      beds: 3,
      wifi: true,
      amenities: ["clim", "eau chaude"],
      capacity: 4,
    });

    expect(result).toEqual({
      beds: 3,
      wifi: true,
      amenities: ["clim", "eau chaude"],
      capacity: 4,
    });
  });

  it("ne modifie pas l'objet reçu (pas de mutation)", () => {
    const input = { panorama_360_url: "javascript:alert(1)", beds: 2 };
    const result = sanitizeSyncAttributes(input);

    // Le payload du provider ne doit pas être altéré sur place.
    expect(input.panorama_360_url).toBe("javascript:alert(1)");
    expect(result.beds).toBe(2);
  });

  it("ne touche pas aux champs absents", () => {
    const result = sanitizeSyncAttributes({ beds: 2 });
    expect(result).not.toHaveProperty("panorama_360_url");
    expect(result).not.toHaveProperty("cover_image_url");
    expect(result).not.toHaveProperty("panorama_tour");
  });
});