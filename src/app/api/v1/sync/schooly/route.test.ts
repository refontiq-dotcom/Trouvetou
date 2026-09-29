// @vitest-environment node
//
// Cette route s'exécute sur le runtime node (`export const runtime = "nodejs"`)
// et importe `next/server`. Lavenue globale du projet est jsdom, choisie pour
// les tests de composants : on rebascule ce fichier sur node, sinon
// `NextRequest` ne se comporte pas comme en production.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Test d'intégration de la ROUTE d'ingestion Schooly.
//
// La base de données est la seule chose simulée. Tout le reste est réel : la
// lecture du corps, la validation de la clé, les appels de sélection, et
// surtout l'OBJET RÉELLEMENT ÉCRIT dans `listings` — capté au moment du
// `upsert`. C'est ce qui permet d'affirmer que `images` ne reçoit plus de
// panorama et que `attributes.panoramas` est bien rempli, sans avoir à
// disposition une base Supabase.
// ============================================================================

/** Ligne capturée au moment du `upsert` sur `listings`. */
let upsertedRow: Record<string, unknown> | null = null;
let upsertOptions: Record<string, unknown> | null = null;

function chain<T>(result: T) {
  // Chaîne Supabase : .select().eq().maybeSingle() / .upsert().select().single()
  const node: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle", "single", "upsert", "order", "limit"]) {
    node[method] = vi.fn(() => node);
  }
  // Supabase renvoie TOUJOURS un objet `{ data, error }` : la route déstructure
  // ce résultat. Renvoyer la ligne nue ferait lire `provider` comme undefined et
  // la route répondrait « Provider inconnu » (401).
  node.maybeSingle = vi.fn(async () => ({ data: result, error: null }));
  node.single = vi.fn(async () => ({ data: result, error: null }));
  node.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result, error: null }).then(resolve);
  return node;
}

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => {
    const table = (name: string) => {
      if (name === "providers") {
        return chain({ id: "prov-1", name: "Schooly CI", api_key_hash: "hash", is_active: true });
      }
      if (name === "categories") {
        return chain({ id: "cat-school" });
      }
      return chain({ id: "listing-1", external_id: "s1", is_available: true });
    };

    return {
      from: (name: string) => {
        const node = table(name);
        if (name === "listings") {
          node.upsert = vi.fn((row: Record<string, unknown>, options: Record<string, unknown>) => {
            upsertedRow = row;
            upsertOptions = options;
            return chain({ id: "listing-1", external_id: "s1", is_available: true });
          });
        }
        return node;
      },
      rpc: vi.fn(async () => ({ data: { ok: true }, error: null })),
    };
  },
}));

// La clé est valide pour l'analyse de format ; l'empreinte est simulée.
vi.mock("@/lib/sync/api-key", () => ({
  hashApiKey: () => "hash",
  parseProviderIdFromKey: (key: string) => (key.startsWith("tv_live_") ? "prov-1" : null),
  secureCompare: () => true,
}));

const { POST } = await import("./route");

const CLE = "tv_live_11111111-1111-1111-1111-111111111111.secret";

const PANORAMA = {
  id: "22222222-2222-2222-2222-222222222222",
  media_type: "photo_360",
  url: "https://pub.exemple.r2.dev/schooly/production/360/s1/pano.jpg",
  width: 6000,
  height: 3000,
  byte_size: 4200000,
  content_type: "image/jpeg",
  room_id: null,
  projection: "equirectangular_2_1",
  validated_at: "2026-09-28T10:00:00.000Z",
} as const;

function body(school: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/sync/schooly", {
    method: "POST",
    headers: { "x-trouvetou-api-key": CLE, "content-type": "application/json" },
    body: JSON.stringify({
      school: { id: "s1", nom: "École Test", ...school },
      levels: [{ id: "l1", label: "6e" }],
    }),
  });
}

async function ingest(school: Record<string, unknown>) {
  const res = await POST(body(school));
  // Le code d'erreur est renvoyé pour qu'un échec dise POURQUOI, au lieu
  // d'afficher un « expected 401 to be 200 » sans piste.
  const json = (await res.clone().json().catch(() => ({}))) as { code?: string };
  return { status: res.status, row: upsertedRow, code: json.code };
}

const attrs = () => (upsertedRow?.attributes ?? {}) as Record<string, unknown>;
const images = () => (upsertedRow?.images ?? []) as string[];
const panoramas = () => (attrs().panoramas ?? []) as Array<Record<string, unknown>>;

// ===========================================================================
// CONTRAT INTER-DÉPÔTS
//
// Le corps ci-dessous n'est PAS inventé : c'est le payload RÉEL produit par
// `apps/schooly/src/app/api/v1/admin/trouvetou/publish/route.ts` de Schooly
// après son test, capturé sur disque (`/tmp/contrat/payload-trouvetou.json`).
// Il est recopié ici pour que ce test reste autonome.
//
// Il prouve ce qu'aucun test ne prouvait avant : que ce que Schooly écrit est
// réellement consommable par cette ingestion, et non seulement que chacune des
// deux fonctions fonctionne isolément de son rôle.
// ===========================================================================
const PAYLOAD_ECOSSE_SCOLY = {
  school: {
    id: "s1",
    schooly_instance_url: "https://admin.schooly.ci",
    nom: "École Test",
    ville: "Abidjan",
    latitude: 5.3,
    longitude: -4,
    description_publique: "Une école.",
    itineraire: null,
    cover_photo: "https://cdn.exemple/cover.jpg",
    gallery: ["https://cdn.exemple/1.jpg", "https://cdn.exemple/2.jpg"],
    photos_360: ["https://pub.r2.dev/legacy-360.jpg"],
    panoramas: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        media_type: "photo_360",
        url: "https://pub.r2.dev/schooly/production/360/s1/1111.jpg",
        width: 6000,
        height: 3000,
        byte_size: 4200000,
        content_type: "image/jpeg",
        room_id: null,
        projection: "equirectangular_2_1",
        validated_at: "2026-09-28T10:00:00.000Z",
      },
    ],
    video_url: null,
    grille_tarifaire_publique: [],
    contact: {
      address: "Cocody",
      phone: "+2250700000000",
      email: "contact@exemple.ci",
      website: null,
    },
    highlights: [],
    admission_notes: null,
    published: true,
  },
  // `levels` est un frère de `school` dans le corps, pas un champ de l'école :
  // la route le lit à la racine (`payload.levels`).
  levels: [
    { id: "n1", label: "6e", capacity: 0, prix_min: null, prix_max: null, places_disponibles: 0 },
    { id: "n2", label: "5e", capacity: 0, prix_min: null, prix_max: null, places_disponibles: 0 },
  ],
};

beforeEach(() => {
  upsertedRow = null;
  upsertOptions = null;
  process.env.TROUVETOU_API_KEY_PEPPER = "poivre-de-test";
});

describe("POST /api/v1/sync/schooly — médias", () => {
  it("cas A : photos classiques seulement, panoramas vide", async () => {
    const { status, row, code } = await ingest({
      cover_photo: "https://cdn.exemple/cover.jpg",
      gallery: ["https://cdn.exemple/1.jpg", "https://cdn.exemple/2.jpg"],
    });

    expect(code).toBeUndefined();
    expect(status).toBe(200);
    expect(row).not.toBeNull();
    expect(images()).toEqual([
      "https://cdn.exemple/cover.jpg",
      "https://cdn.exemple/1.jpg",
      "https://cdn.exemple/2.jpg",
    ]);
    expect(panoramas()).toEqual([]);
  });

  it("cas B : un panorama arrive dans attributes.panoramas, PAS dans images", async () => {
    const { status } = await ingest({
      cover_photo: "https://cdn.exemple/cover.jpg",
      photos_360: ["https://pub.exemple.r2.dev/ancien.jpg"],
      panoramas: [PANORAMA],
    });

    expect(status).toBe(200);
    // Le comportement historique : un panorama dans `images`. Il ne doit plus
    // se produire, car `images[0]` sert de vignette plate dans tout le catalogue.
    expect(images()).toEqual(["https://cdn.exemple/cover.jpg"]);
    expect(images()).not.toContain("https://pub.exemple.r2.dev/ancien.jpg");

    expect(panoramas()).toHaveLength(1);
    expect(panoramas()[0]).toMatchObject({
      id: PANORAMA.id,
      media_type: "photo_360",
      projection: "equirectangular_2_1",
      width: 6000,
      height: 3000,
    });
  });

  it("ne fabrique jamais un panorama depuis une URL nue", async () => {
    // §12.5 : la projection n'est pas garantie tant que le stitcher n'existe
    // pas. Une URL seule ne suffit pas à autoriser une vue 360°.
    const { status } = await ingest({ photos_360: ["https://pub.exemple.r2.dev/ancien.jpg"] });

    expect(status).toBe(200);
    expect(panoramas()).toEqual([]);
    expect(images()).toEqual([]);
    // La trace est conservée pour la §12.3 et le diagnostic.
    expect(attrs().photos_360).toEqual(["https://pub.exemple.r2.dev/ancien.jpg"]);
  });

  it("cas C : les deux flux coexistent dans deux champs distincts", async () => {
    await ingest({
      cover_photo: "https://cdn.exemple/cover.jpg",
      gallery: ["https://cdn.exemple/1.jpg"],
      panoramas: [PANORAMA],
    });

    expect(images()).toHaveLength(2);
    expect(panoramas()).toHaveLength(1);
    // Aucun recoupement entre les deux listes.
    const urls = panoramas().map((p) => p.url);
    for (const url of images()) expect(urls).not.toContain(url);
  });

  it("cas D : deux synchronisations identiques écrivent la même chose", async () => {
    await ingest({ cover_photo: "https://cdn.exemple/c.jpg", panoramas: [PANORAMA] });
    const premier = JSON.stringify(attrs().panoramas);

    upsertedRow = null;
    await ingest({ cover_photo: "https://cdn.exemple/c.jpg", panoramas: [PANORAMA] });

    expect(panoramas()).toHaveLength(1);
    // `attrs()` relit la variable à chaque appel : y accéder directement après
    // `upsertedRow = null` ferait réduire le type à `never` par TypeScript, la
    // réassignation faite par la route n'étant pas visible pour lui.
    expect(JSON.stringify(attrs().panoramas)).toBe(premier);
  });

  it("cas D bis : un doublon dans le payload ne fait pas de doublon en base", async () => {
    await ingest({ panoramas: [PANORAMA, { ...PANORAMA, url: "https://autre.r2.dev/pano.jpg" }] });
    expect(panoramas()).toHaveLength(1);
  });

  it("cas E : deux panoramas distincts sont tous conservés", async () => {
    await ingest({
      panoramas: [
        PANORAMA,
        { ...PANORAMA, id: "33333333-3333-3333-3333-333333333333", url: "https://pub.exemple.r2.dev/b.jpg" },
      ],
    });
    expect(panoramas()).toHaveLength(2);
  });

  it("cas F : une visite non publiée n'est pas injectée", async () => {
    for (const status of ["uploaded", "validated", "rejected"]) {
      upsertedRow = null;
      await ingest({ panoramas: [{ ...PANORAMA, status }] });
      expect(panoramas(), `statut ${status}`).toEqual([]);
    }
  });

  it("cas G : un panorama retiré de la source disparaît de la fiche", async () => {
    // L'upsert remplace `attributes` en entier : la liste reçue fait foi, il
    // n'existe donc aucun mécanisme à réinventer pour purger.
    await ingest({ panoramas: [PANORAMA] });
    expect(panoramas()).toHaveLength(1);

    upsertedRow = null;
    await ingest({ panoramas: [] });
    expect(panoramas()).toEqual([]);
  });

  it("cas H : une école historique sans panoramas est acceptée telle quelle", async () => {
    const { status } = await ingest({ cover_photo: "https://cdn.exemple/c.jpg" });

    expect(status).toBe(200);
    expect(panoramas()).toEqual([]);
    expect(images()).toEqual(["https://cdn.exemple/c.jpg"]);
  });

  it("écrase toujours sur le même conflit : c'est ce qui rend la sync idempotente", async () => {
    await ingest({ cover_photo: "https://cdn.exemple/c.jpg" });
    expect(upsertOptions).toEqual({ onConflict: "provider_id,external_id" });
  });

  it("écarte une URL non http(s) venue de Schooly", async () => {
    await ingest({
      cover_photo: "https://cdn.exemple/c.jpg",
      gallery: ["javascript:alert(1)"],
      panoramas: [{ ...PANORAMA, url: "javascript:alert(1)" }],
    });

    expect(images()).toEqual(["https://cdn.exemple/c.jpg"]);
    expect(panoramas()).toEqual([]);
  });
});

/** Rejoue le payload réel de Schooly contre l'ingestion. */
async function posterContratSchooly() {
  const res = await POST(
    new NextRequest("http://localhost/api/v1/sync/schooly", {
      method: "POST",
      headers: { "x-trouvetou-api-key": CLE, "content-type": "application/json" },
      body: JSON.stringify(PAYLOAD_ECOSSE_SCOLY),
    }),
  );
  return res.status;
}

describe("contrat Schooly → Trouvetou (payload réel)", () => {
  it("le payload émis par Schooly est consommé tel quel", async () => {
    expect(await posterContratSchooly()).toBe(200);

    // Le panorama schooly devient une entrée exploitable…
    expect(panoramas()).toHaveLength(1);
    expect(panoramas()[0]).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      media_type: "photo_360",
      projection: "equirectangular_2_1",
      url: "https://pub.r2.dev/schooly/production/360/s1/1111.jpg",
      width: 6000,
      height: 3000,
    });

    // …et les photos classiques arrivent par l'autre chemin, intactes.
    expect(images()).toEqual([
      "https://cdn.exemple/cover.jpg",
      "https://cdn.exemple/1.jpg",
      "https://cdn.exemple/2.jpg",
    ]);

    // `photos_360` reste tracé mais n'est jamais promu en panorama.
    expect(attrs().photos_360).toEqual(["https://pub.r2.dev/legacy-360.jpg"]);
  });

  it("la sortie est directement lisible par toListingView, source de RoomCard", async () => {
    // Dernier maillon : la ligne écrite est relue par l'adaptateur
    // d'affichage, et c'est exactement ce champ que RoomCard consomme.
    expect(await posterContratSchooly()).toBe(200);

    const { toListingView } = await import("@/lib/supabase/listing-view");
    const vue = toListingView({
      id: "listing-1",
      external_id: "s1",
      title: "École Test",
      base_price: null,
      images: images(),
      description: null,
      attributes: attrs(),
      updated_at: "2026-09-28T10:00:00.000Z",
      provider_id: "prov-1",
      city: "Abidjan",
      provider: { name: "Schooly CI" },
      category: { slug: "school" },
    } as never);

    expect(vue.panoramas).toHaveLength(1);
    expect(vue.panoramas[0].id).toBe("11111111-1111-1111-1111-111111111111");
    expect(vue.images).toEqual(images());
  });
});
