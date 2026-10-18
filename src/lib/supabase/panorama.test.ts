import { describe, expect, it } from "vitest";
import { parsePanorama, parsePanoramas } from "./panorama";

/**
 * Tests du contrat `attributes.panoramas`.
 *
 * Ce parseur est la PREMIÈRE barrière de sécurité de la visionneuse : il
 * décide si une entrée du jsonb devient une « photo 360° » affichée en
 * équirectangulaire. Une entrée acceptée à tort produit exactement ce que la
 * feature ne doit pas produire — une image plate présentée comme une visite.
 */

/** Entrée Schooly conforme au contrat §12. */
const valide = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  media_type: "photo_360",
  url: "https://pub.example.r2.dev/schooly/production/360/s1/1111.jpg",
  width: 6000,
  height: 3000,
  byte_size: 4_200_000,
  content_type: "image/jpeg",
  room_id: null,
  projection: "equirectangular_2_1",
  validated_at: "2026-09-28T10:00:00.000Z",
  ...overrides,
});

describe("parsePanorama — données valides", () => {
  it("convertit une entrée conforme", () => {
    const resultat = parsePanorama(valide());
    expect(resultat).not.toBeNull();
    expect(resultat?.media_type).toBe("photo_360");
    expect(resultat?.projection).toBe("equirectangular_2_1");
    expect(resultat?.width).toBe(6000);
  });

  it("accepte une entrée sans dimensions : le contrat les rend facultatives", () => {
    // Schooly peut envoyer null si le validateur n'a pas mesuré. Refuser
    // l'entrée ferait perdre une vraie visite 360°.
    const resultat = parsePanorama(valide({ width: null, height: null }));
    expect(resultat).not.toBeNull();
    expect(resultat?.width).toBeNull();
  });

  it("conserve le rattachement à une chambre", () => {
    expect(parsePanorama(valide({ room_id: "chambre-7" }))?.room_id).toBe("chambre-7");
  });

  it("tolère une légère imprécision de ratio", () => {
    // 5998x3000 vient d'un recadrage : ce n'est pas la peine de le rejeter.
    expect(parsePanorama(valide({ width: 5998, height: 3000 }))).not.toBeNull();
  });
});

describe("parsePanorama — refus de sécurité", () => {
  it.each([
    ["javascript:alert(1)", "schéma javascript"],
    ["data:image/png;base64,AAAA", "schéma data"],
    ["/relative/360.jpg", "URL relative"],
    ["", "URL vide"],
  ])("refuse l'URL %s (%s)", (url) => {
    expect(parsePanorama(valide({ url }))).toBeNull();
  });

  it("refuse une entrée sans media_type photo_360", () => {
    // Une photo classique rangée dans le même tableau ne doit pas devenir une
    // visite : ce serait la « fausse 360° » par excellence.
    expect(parsePanorama(valide({ media_type: "photo" }))).toBeNull();
    expect(parsePanorama(valide({ media_type: undefined }))).toBeNull();
  });

  it("refuse une projection inconnue", () => {
    expect(parsePanorama(valide({ projection: "cylindrical" }))).toBeNull();
  });

  it("refuse un ratio qui n'est pas 2:1", () => {
    // 4:3 étiré sur une sphère donne une image déformée, pas une vue 360°.
    expect(parsePanorama(valide({ width: 4000, height: 3000 }))).toBeNull();
  });

  it.each([null, undefined, 42, "chaine", [], {}])("refuse la valeur non objet %s", (value) => {
    expect(parsePanorama(value)).toBeNull();
  });
});

describe("parsePanoramas — liste", () => {
  it("renvoie une liste vide quand le champ est absent", () => {
    // Cas de la grande majorité des annonces, et de toutes les DONNÉES
    // ANCIENNES créées avant le champ `panoramas`.
    expect(parsePanoramas(undefined)).toEqual([]);
    expect(parsePanoramas(null)).toEqual([]);
  });

  it("renvoie une liste vide quand le champ n'est pas un tableau", () => {
    expect(parsePanoramas("pas-un-tableau")).toEqual([]);
    expect(parsePanoramas({ url: "https://x/1.jpg" })).toEqual([]);
  });

  it("conserve les entrées valides et ignore les autres", () => {
    const resultat = parsePanoramas([valide(), valide({ url: "javascript:x" }), valide({ media_type: "photo" })]);
    expect(resultat).toHaveLength(1);
  });

  it("ne laisse jamais passer une entrée non conforme", () => {
    const resultat = parsePanoramas([null, "x", 3, { media_type: "photo_360" }]);
    expect(resultat).toEqual([]);
  });
});
