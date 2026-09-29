import { describe, expect, it } from "vitest";
import {
  normalizeHttpUrlList,
  toClassicImages,
  toPanoramas,
} from "./schooly-media";

// ============================================================================
// Tests du tri des médias à l'ingestion Schooly.
//
// Ces tests portent sur la FONCTION, pas sur la route : la route exige une clé
// API valide et un client Supabase, ce qui n'apporte rien à vérifier une liste
// d'URL. Ce qui compte ici, c'est la frontière entre photos classiques et
// panoramas — exactement l'endroit où le défaut d'origine s'était glissé.
// ============================================================================

/** Panorama conforme au contrat §12, avec les identifiants de l'exemple du doc. */
const PANORAMA_VALIDE = {
  id: "11111111-1111-1111-1111-111111111111",
  media_type: "photo_360",
  url: "https://pub.exemple.r2.dev/schooly/production/360/s1/1111.jpg",
  width: 6000,
  height: 3000,
  byte_size: 4200000,
  content_type: "image/jpeg",
  room_id: null,
  projection: "equirectangular_2_1",
  validated_at: "2026-09-28T10:00:00.000Z",
} as const;

const SECOND_PANORAMA = {
  ...PANORAMA_VALIDE,
  id: "22222222-2222-2222-2222-222222222222",
  url: "https://pub.exemple.r2.dev/schooly/production/360/s1/2222.jpg",
} as const;

describe("schooly-media — photos classiques", () => {
  it("cas A : n'envoie que les photos classiques dans images", () => {
    // Annonce sans panorama. `panoramas` doit exister mais vide : la visionneuse
    // ne montre rien, la galerie reste intacte.
    const school = {
      cover_photo: "https://cdn.exemple/cover.jpg",
      gallery: ["https://cdn.exemple/1.jpg", "https://cdn.exemple/2.jpg"],
    };

    expect(toClassicImages(school)).toEqual([
      "https://cdn.exemple/cover.jpg",
      "https://cdn.exemple/1.jpg",
      "https://cdn.exemple/2.jpg",
    ]);
    expect(toPanoramas(school)).toEqual([]);
  });

  it("place la photo principale en premier : c'est elle qui sert de vignette", () => {
    // Tous les consommateurs font `images[0]` (room-card, boosted-carousel,
    // booking-modal, compare). L'ordre n'est donc pas un détail.
    const images = toClassicImages({
      cover_photo: "https://cdn.exemple/cover.jpg",
      gallery: ["https://cdn.exemple/1.jpg"],
    });
    expect(images[0]).toBe("https://cdn.exemple/cover.jpg");
  });

  it("refuse une URL non http(s) dans la galerie", () => {
    const images = toClassicImages({
      gallery: ["javascript:alert(1)", "data:text/html;base64,PHN2Zz4=", "https://ok.exemple/1.jpg"],
    });
    expect(images).toEqual(["https://ok.exemple/1.jpg"]);
  });

  it("déduplique la galerie", () => {
    const images = toClassicImages({
      cover_photo: "https://cdn.exemple/a.jpg",
      gallery: ["https://cdn.exemple/a.jpg", "https://cdn.exemple/b.jpg", "https://cdn.exemple/b.jpg"],
    });
    expect(images).toEqual(["https://cdn.exemple/a.jpg", "https://cdn.exemple/b.jpg"]);
  });
});

describe("schooly-media — panoramas", () => {
  it("cas B : n'accepte un panorama que depuis le champ `panoramas`", () => {
    // Une URL nue dans `photos_360` ne prouve ni le type ni la projection.
    // La §12.5 avertit qu'un logo 2:1 passerait tous les contrôles. On refuse
    // donc de fabriquer un panorama, plutôt que d'en inventer un.
    const school = { photos_360: ["https://cdn.exemple/panorama.jpg"] };

    expect(toPanoramas(school)).toEqual([]);
    // Et ce panorama ne doit surtout pas avoir atterri dans la galerie.
    expect(toClassicImages(school)).toEqual([]);
  });

  it("lit le contrat riche §12", () => {
    const panoramas = toPanoramas({ panoramas: [PANORAMA_VALIDE] });

    expect(panoramas).toHaveLength(1);
    expect(panoramas[0]).toMatchObject({
      id: PANORAMA_VALIDE.id,
      media_type: "photo_360",
      projection: "equirectangular_2_1",
      width: 6000,
      height: 3000,
      room_id: null,
    });
  });

  it("cas C : photos classiques et panorama coexistent, sans se mélanger", () => {
    // Le point exact du correctif : les deux flux alimentent deux champs
    // différents et aucun média ne traverse l'autre.
    const school = {
      cover_photo: "https://cdn.exemple/cover.jpg",
      gallery: ["https://cdn.exemple/1.jpg"],
      photos_360: ["https://pub.exemple.r2.dev/legacy.jpg"],
      panoramas: [PANORAMA_VALIDE],
    };

    const images = toClassicImages(school);
    const panoramas = toPanoramas(school);

    expect(images).toEqual(["https://cdn.exemple/cover.jpg", "https://cdn.exemple/1.jpg"]);
    expect(panoramas).toHaveLength(1);

    // Aucune URL de panorama ne doit se retrouver dans `images`.
    for (const url of images) expect(url).not.toContain("legacy");
    for (const panorama of panoramas) expect(images).not.toContain(panorama.url);
  });

  it("cas D : une synchronisation répétée ne duplique pas le panorama", () => {
    const payload = { panoramas: [PANORAMA_VALIDE] };

    const premiere = toPanoramas(payload);
    const seconde = toPanoramas(payload);

    expect(premiere).toHaveLength(1);
    expect(seconde).toHaveLength(1);
    expect(seconde).toEqual(premiere);
  });

  it("cas D bis : déduplique sur l'identifiant stable, pas sur l'URL", () => {
    // Le même média réémis avec une URL différente (nouveau domaine R2) reste
    // un seul panorama : c'est `id` qui fait foi.
    const doublon = { ...PANORAMA_VALIDE, url: "https://nouveau-domaine.r2.dev/1111.jpg" };
    const panoramas = toPanoramas({ panoramas: [PANORAMA_VALIDE, doublon] });

    expect(panoramas).toHaveLength(1);
    expect(panoramas[0].url).toBe(PANORAMA_VALIDE.url);
  });

  it("cas E : garde deux panoramas distincts", () => {
    const panoramas = toPanoramas({ panoramas: [PANORAMA_VALIDE, SECOND_PANORAMA] });

    expect(panoramas).toHaveLength(2);
    expect(panoramas.map((p) => p.id)).toEqual([PANORAMA_VALIDE.id, SECOND_PANORAMA.id]);
  });

  it("cas F : refuse une visite non publiée", () => {
    // Schooly ne devrait jamais envoyer autre chose que du `published`
    // (`toTrouvetouMediaContract` renvoie null sinon), mais l'ingestion est une
    // frontière réseau : un statut explicite non publié fait rejeter l'entrée.
    for (const status of ["uploaded", "validated", "rejected"]) {
      const panoramas = toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, status }] });
      expect(panoramas, `statut ${status}`).toEqual([]);
    }

    expect(toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, status: "published" }] })).toHaveLength(1);
  });

  it("cas F bis : refuse un panorama au mauvais rapport ou à la mauvaise projection", () => {
    expect(toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, width: 1000, height: 1000 }] })).toEqual([]);
    expect(toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, projection: "cubemap" }] })).toEqual([]);
    expect(toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, media_type: "photo" }] })).toEqual([]);
    expect(toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, url: "javascript:alert(1)" }] })).toEqual([]);
  });

  it("cas G : un panorama retiré de la source disparaît", () => {
    // La route écrit `attributes` en écrasant la colonne (upsert complet), donc
    // la liste reçue fait foi. Une source redevenue sans panorama donne une
    // liste vide : pas de fantôme conservé indéfiniment.
    const avec = toPanoramas({ panoramas: [PANORAMA_VALIDE] });
    const sans = toPanoramas({ panoramas: [] });

    expect(avec).toHaveLength(1);
    expect(sans).toEqual([]);
  });

  it("cas H : une annonce historique sans champ panoramas reste exploitable", () => {
    // Le champ peut être absent, null, ou un vieux format : dans tous les cas
    // on obtient une liste vide, jamais une exception.
    expect(toPanoramas({})).toEqual([]);
    expect(toPanoramas({ panoramas: null })).toEqual([]);
    expect(toPanoramas({ panoramas: "https://cdn.exemple/x.jpg" })).toEqual([]);
    expect(toPanoramas({ panoramas: [null, 42, "texte"] })).toEqual([]);
  });

  it("reporte room_id sans jamais s'en servir pour lier", () => {
    // §12.4 : l'identifiant Schooly n'est pas interchangeable avec celui de
    // Trouvetou. On le recopie tel quel, opaque — aucun lien n'est tenté.
    const panoramas = toPanoramas({ panoramas: [{ ...PANORAMA_VALIDE, room_id: "dorm-uuid-1" }] });
    expect(panoramas[0].room_id).toBe("dorm-uuid-1");
  });
});

describe("schooly-media — normalisation d'URL", () => {
  it("ignore ce qui n'est pas un tableau", () => {
    expect(normalizeHttpUrlList(null)).toEqual([]);
    expect(normalizeHttpUrlList("https://a.exemple/x.jpg")).toEqual([]);
  });

  it("élimine les entrées vides et les doublons", () => {
    expect(normalizeHttpUrlList(["https://a.exemple/x.jpg", "", "   ", null, "https://a.exemple/x.jpg"]))
      .toEqual(["https://a.exemple/x.jpg"]);
  });
});
