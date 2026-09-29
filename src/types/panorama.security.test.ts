import { describe, expect, it } from "vitest";
import { normalizePanoramaTour, validatePanoramaTour } from "./panorama";

// ============================================================================
// Sécurité des URL de panorama — testée au NIVEAU DU CONTRAT PUBLIC.
//
// Ces tests ne vérifient pas `safeHttpUrl` (déjà couvert dans
// `src/lib/http/url.test.ts`) mais le fait que le modèle `PanoramaTour`,
// point d'entrée unique de TOUS les panoramas quels que soient les providers,
// refuse réellement une URL dangereuse. C'est ce qui prouve que le câblage
// n'est pas contourné : un `scene.src` en `javascript:` ne peut plus atteindre
// une texture WebGL, quel que soit le connecteur qui l'ait produite.
// ============================================================================

const VALID_SCENE = {
  id: "chambre-1",
  name: "Chambre 1",
  kind: "room",
  src: "https://cdn.example.test/panorama-1.webp",
} as const;

function tourOf(scenes: unknown[], links: unknown[] = []) {
  return { version: 1, startSceneId: null, scenes, links };
}

describe("normalizePanoramaTour — sécurité des URL de scène", () => {
  it("conserve une scène dont l'URL est http/https", () => {
    const tour = normalizePanoramaTour(tourOf([VALID_SCENE]));

    expect(tour.scenes).toHaveLength(1);
    expect(tour.scenes[0].src).toBe("https://cdn.example.test/panorama-1.webp");
  });

  it.each([
    ["javascript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    ["file:///etc/passwd"],
  ])("écarte la scène dont src est %s", (src) => {
    const tour = normalizePanoramaTour(tourOf([{ ...VALID_SCENE, src }]));

    expect(tour.scenes).toHaveLength(0);
  });

  it("écarte la scène dont previewSrc est dangereux", () => {
    // `previewSrc` sert de fond pendant le chargement : une URL dangereuse
    // ici n'est pas moins dangereuse que `src`.
    const tour = normalizePanoramaTour(
      tourOf([{ ...VALID_SCENE, previewSrc: "javascript:alert(1)" }])
    );

    expect(tour.scenes).toHaveLength(0);
  });

  it("conserve une scène dont previewSrc est valide", () => {
    const tour = normalizePanoramaTour(
      tourOf([{ ...VALID_SCENE, previewSrc: "https://cdn.example.test/preview.jpg" }])
    );

    expect(tour.scenes).toHaveLength(1);
    expect(tour.scenes[0].previewSrc).toBe("https://cdn.example.test/preview.jpg");
  });

  it("écarte uniquement la scène compromise et préserve les scènes saines", () => {

describe("validatePanoramaTour — diagnostic exploitable par le provider", () => {
  it("signale précisément une URL de scène dangereuse", () => {
    // Sans ce cas, un `javascript:` remonterait comme un banal
    // « invalid_scene » et le provider ne pouvait pas comprendre le refus.
    const issues = validatePanoramaTour(
      tourOf([{ id: "a", name: "A", kind: "room", src: "javascript:alert(1)" }])
    );

    expect(issues.some((issue) => issue.code === "invalid_scene_src")).toBe(true);
    expect(
      issues.some((issue) => issue.code === "invalid_scene_src" && issue.sceneId === "a")
    ).toBe(true);
  });

  it("signale précisément une URL d'aperçu dangereuse", () => {
    const issues = validatePanoramaTour(
      tourOf([{ ...VALID_SCENE, previewSrc: "javascript:alert(1)" }])
    );

    expect(issues.some((issue) => issue.code === "invalid_scene_src")).toBe(true);
  });

  it("distingue une scène malformée d'une URL dangereuse", () => {
    // Séparer les deux diagnostics est ce qui rend le message utile.
    const issues = validatePanoramaTour(
      tourOf([{ id: "", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" }])
    );

    expect(issues.some((issue) => issue.code === "invalid_scene")).toBe(true);
    expect(issues.some((issue) => issue.code === "invalid_scene_src")).toBe(false);
  });

  it("n'émet aucun diagnostic sur un tour valide et cohérent", () => {
    const issues = validatePanoramaTour(
      tourOf(
        [
          { id: "a", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" },
          { id: "b", name: "B", kind: "corridor", src: "https://cdn.example.test/b.webp" },
        ],
        [{ id: "a-b", fromSceneId: "a", toSceneId: "b", yaw: 0, pitch: 0, label: "Couloir" }]
      )
    );

    expect(issues).toEqual([]);
  });
});

describe("normalizePanoramaTour — structure du graphe (non régression)", () => {
  it("retire les liens pointant vers une scène absente", () => {
    const tour = normalizePanoramaTour(
      tourOf(
        [
          { id: "a", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" },
          { id: "b", name: "B", kind: "corridor", src: "https://cdn.example.test/b.webp" },
        ],
        [
          { id: "ok", fromSceneId: "a", toSceneId: "b", yaw: 0, pitch: 0, label: "Couloir" },
          { id: "orphan", fromSceneId: "a", toSceneId: "missing", yaw: 0, pitch: 0, label: "X" },
        ]
      )
    );

    expect(tour.links).toHaveLength(1);
    expect(tour.links[0].id).toBe("ok");
  });

  it("déduplique les scènes par identifiant et garde la première occurrence", () => {
    const tour = normalizePanoramaTour(
      tourOf([
        { id: "a", name: "Première", kind: "room", src: "https://cdn.example.test/a.webp" },
        { id: "a", name: "Doublon", kind: "room", src: "https://cdn.example.test/dup.webp" },
      ])
    );

    expect(tour.scenes).toHaveLength(1);
    expect(tour.scenes[0].name).toBe("Première");
  });

  it("normalise la scène de départ et n'en marque qu'une", () => {
    const tour = normalizePanoramaTour({
      version: 1,
      startSceneId: "b",
      scenes: [
        { id: "a", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" },
        { id: "b", name: "B", kind: "room", src: "https://cdn.example.test/b.webp" },
      ],
      links: [],
    });

    expect(tour.startSceneId).toBe("b");
    expect(tour.scenes.filter((scene) => scene.isStart).map((scene) => scene.id)).toEqual(["b"]);
  });

  it("retombe sur la première scène si la scène de départ n'existe pas", () => {
    const tour = normalizePanoramaTour({
      version: 1,
      startSceneId: "missing",
      scenes: [{ id: "a", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" }],
      links: [],
    });

    expect(tour.startSceneId).toBe("a");
  });

  it("écarte les liens dont les angles sont invalides", () => {
    const tour = normalizePanoramaTour(
      tourOf(
        [
          { id: "a", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" },
          { id: "b", name: "B", kind: "room", src: "https://cdn.example.test/b.webp" },
        ],
        [
          { id: "ok", fromSceneId: "a", toSceneId: "b", yaw: 0, pitch: 0, label: "OK" },
          { id: "nan", fromSceneId: "a", toSceneId: "b", yaw: Number.NaN, pitch: 0, label: "NaN" },
        ]
      )
    );

    expect(tour.links.map((link) => link.id)).toEqual(["ok"]);
  });

  it("écarte un hotspot dont la scène parente ne correspond pas", () => {
    const tour = normalizePanoramaTour(
      tourOf([
        {
          ...VALID_SCENE,
          infoHotspots: [
            { id: "h-ok", sceneId: "chambre-1", yaw: 0, pitch: 0, title: "Lampes" },
            { id: "h-bad", sceneId: "autre-scene", yaw: 0, pitch: 0, title: "Orphelin" },
          ],
        },
      ])
    );

    expect(tour.scenes[0].infoHotspots?.map((hotspot) => hotspot.id)).toEqual(["h-ok"]);
  });

  it("borne le pitch d'un hotspot hors limites", () => {
    const tour = normalizePanoramaTour(
      tourOf([
        {
          ...VALID_SCENE,
          infoHotspots: [{ id: "h", sceneId: "chambre-1", yaw: 0, pitch: 99, title: "Haut" }],
        },
      ])
    );

    expect(tour.scenes[0].infoHotspots?.[0].pitch).toBeCloseTo(Math.PI / 2);
  });
});

    // Une URL contaminée ne doit pas faire disparaître toute la visite.
    const tour = normalizePanoramaTour(
      tourOf([
        { id: "a", name: "A", kind: "room", src: "https://cdn.example.test/a.webp" },
        { id: "b", name: "B", kind: "room", src: "javascript:alert(1)" },
        { id: "c", name: "C", kind: "lobby", src: "https://cdn.example.test/c.webp" },
      ])
    );

    expect(tour.scenes.map((scene) => scene.id)).toEqual(["a", "c"]);
  });

  it("retourne un tour vide pour une entrée non-objet", () => {
    expect(normalizePanoramaTour(null).scenes).toEqual([]);
    expect(normalizePanoramaTour("panorama").scenes).toEqual([]);
    expect(normalizePanoramaTour(42).scenes).toEqual([]);
  });
});
