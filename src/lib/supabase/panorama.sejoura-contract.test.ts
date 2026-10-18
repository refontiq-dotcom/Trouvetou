import { describe, expect, it } from "vitest";
import { toListingView } from "./listing-view";
import { parsePanoramas } from "./panorama";
import type { ListedListing } from "./listings";

/**
 * Contrat Séjoura → Trouvetou (`attributes.panoramas`).
 *
 * Ce payload est la copie exacte de ce que `buildTrouvetouPanoramas()` produit
 * côté Séjoura (src/lib/media/panorama.ts), après un aller-retour JSON → jsonb.
 * Si ce test casse, la visite 360° d'une annonce Séjoura cesse de s'afficher :
 * il faut alors aligner les deux dépôts, pas assouplir ce test.
 */
const SENT_BY_SEJOURA = {
  id: "5a0f2c1e-8c53-4b3a-9d55-0d6f4f1b2a10",
  media_type: "photo_360",
  projection: "equirectangular_2_1",
  url: "https://pub.sejoura.example/room-panoramas/rt1/p1.jpg",
  width: 6000,
  height: 3000,
  content_type: "image/jpeg", // champ supplémentaire : doit être toléré
  room_id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1",
  validated_at: "2026-10-01T10:00:00.000Z",
};

describe("contrat Séjoura → Trouvetou", () => {
  it("accepte le panorama tel que Séjoura l'envoie", () => {
    const [panorama] = parsePanoramas([JSON.parse(JSON.stringify(SENT_BY_SEJOURA))]);
    expect(panorama).toMatchObject({
      id: SENT_BY_SEJOURA.id,
      url: SENT_BY_SEJOURA.url,
      width: 6000,
      height: 3000,
      room_id: SENT_BY_SEJOURA.room_id,
    });
  });

  it("refuse une image qui n'est pas au ratio 2:1 plutôt que de l'étirer", () => {
    expect(parsePanoramas([{ ...SENT_BY_SEJOURA, width: 4000, height: 3000 }])).toEqual([]);
  });

  it("refuse une URL non http(s)", () => {
    expect(parsePanoramas([{ ...SENT_BY_SEJOURA, url: "javascript:alert(1)" }])).toEqual([]);
  });

  it("une annonce Séjoura sans panorama garde `panoramas` vide et ses photos intactes", () => {
    const listing = {
      id: "l1",
      provider_id: "p1",
      title: "Studio",
      images: ["https://cdn.example.com/a.jpg"],
      attributes: { capacity: 2 },
      provider: { name: "Hôtel" },
      category: { slug: "hotel" },
    } as unknown as ListedListing;
    const view = toListingView(listing);
    expect(view.panoramas).toEqual([]);
    expect(view.images).toEqual(["https://cdn.example.com/a.jpg"]);
  });

  it("une annonce Séjoura avec panorama l'expose sans toucher aux photos classiques", () => {
    const listing = {
      id: "l2",
      provider_id: "p1",
      title: "Suite",
      images: ["https://cdn.example.com/a.jpg"],
      attributes: { panoramas: [SENT_BY_SEJOURA] },
      provider: { name: "Hôtel" },
      category: { slug: "hotel" },
    } as unknown as ListedListing;
    const view = toListingView(listing);
    expect(view.panoramas).toHaveLength(1);
    expect(view.images).toEqual(["https://cdn.example.com/a.jpg"]);
  });
});
