import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PanoramaViewer } from "./panorama-viewer";
import type { PanoramaMedia } from "@/lib/supabase/panorama";

/**
 * Tests de la visionneuse.
 *
 * Photo Sphere Viewer est MOCKÉ : il ouvre un contexte WebGL, qu'un DOM jsdom
 * ne fournit pas. Ce que ces tests vérifient est donc le comportement de
 * Trouvetou autour de la bibliothèque — chargement, erreur, fermeture,
 * destruction — pas le rendu panoramique lui-même, qui ne peut pas être
 * validé sans navigateur réel.
 */

const panorama: PanoramaMedia = {
  id: "p1",
  url: "https://pub.example.r2.dev/schooly/production/360/s1/p1.jpg",
  media_type: "photo_360",
  projection: "equirectangular_2_1",
  width: 6000,
  height: 3000,
  room_id: null,
  validated_at: "2026-09-28T10:00:00.000Z",
};

/** Faux PSV : enregistre ce que la visionneuse lui demande et se laisse détruire. */
const destroy = vi.fn();
const rotate = vi.fn();
const zoom = vi.fn();
const getPosition = vi.fn(() => ({ yaw: 12.5, pitch: -3.25 }));
const getZoomLevel = vi.fn(() => 0);
const viewerCtor = vi.fn();

vi.mock("@photo-sphere-viewer/core", () => ({
  Viewer: class {
    constructor(config: unknown) {
      viewerCtor(config);
    }
    addEventListener = vi.fn();
    destroy = destroy;
    rotate = rotate;
    zoom = zoom;
    getPosition = getPosition;
    getZoomLevel = getZoomLevel;
  },
}));

/**
 * jsdom ne télécharge jamais d'image : `new Image()` y reste à l'état vide,
 * donc `onload` ne se déclencherait pas et la visionneuse ne serait jamais
 * construite. On remplace `Image` par un double qui notifie au prochain tour
 * de boucle, comme le ferait un vrai chargement réseau.
 */
function stubImageLoading(shouldSucceed: boolean) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;
    set src(_value: string) {
      queueMicrotask(() => {
        if (shouldSucceed) this.onload?.();
        else this.onerror?.();
      });
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubImageLoading(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PanoramaViewer — chargement", () => {
  it("affiche un état de chargement avant l'initialisation", () => {
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);
    expect(screen.getByText(/Chargement de la visite 360/)).toBeInTheDocument();
  });

  it("passe la projection sous la forme attendue par PSV v5", async () => {
    // PSV v5 veut `{ path }`. La forme `{ type, url }` des exemples PSV v4
    // échoue en `loadTexture` avec « Invalid panorama url » — défaut trouvé au
    // navigateur réel, invisible en test unitaire. L'adaptateur par défaut de
    // PSV étant l'équirectangulaire, `path` suffit et donne la bonne projection.
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);
    await vi.waitFor(() => expect(viewerCtor).toHaveBeenCalled());

    const config = viewerCtor.mock.calls[0][0] as { panorama: { path: string } };
    expect(config.panorama.path).toBe(panorama.url);
  });

  it("retire l'écran de chargement une fois la visionneuse prête", async () => {
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);
    await screen.findByRole("button", { name: "Recentrer la vue" });
    expect(screen.queryByText(/Chargement de la visite 360/)).not.toBeInTheDocument();
  });
});

describe("PanoramaViewer — fermeture", () => {
  it("appelle onClose au clic sur Fermer", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Fermer la visite 360°" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ferme aussi avec la touche Échap", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={onClose} />);

    await screen.findByRole("button", { name: "Fermer la visite 360°" });
    // Échap doit fonctionner sans avoir cliqué au préalable : c'est le geste
    // attendu au clavier, y compris quand le focus n'est nulle part.
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("détruit la visionneuse au démontage", async () => {
    // Sans ce destroy, le contexte WebGL survit à la fermeture de la modale et
    // la mémoire GPU fuit à chaque ouverture.
    const { unmount } = render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);
    await vi.waitFor(() => expect(viewerCtor).toHaveBeenCalled());

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe("PanoramaViewer — recentrage", () => {
  it("revient à la position relevée à l'ouverture", async () => {
    // PSV v5 n'a pas de `reset()`. Le recentrage doit donc rappeler
    // explicitement `rotate` + `zoom` vers la position initiale — sinon le
    // bouton est cliquable et ne fait rien.
    const user = userEvent.setup();
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);

    const bouton = await screen.findByRole("button", { name: "Recentrer la vue" });
    await user.click(bouton);

    expect(rotate).toHaveBeenCalledWith({ yaw: 12.5, pitch: -3.25 });
    expect(zoom).toHaveBeenCalledWith(0);
  });

  it("ne propose pas le recentrage tant que la vue n'est pas prête", () => {
    // Un bouton qui ne fait rien est pire qu'un bouton absent.
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Recentrer la vue" })).not.toBeInTheDocument();
  });
});

describe("PanoramaViewer — échec de chargement", () => {
  it("affiche un message d'erreur et reste fermable si l'image est invalide", async () => {
    viewerCtor.mockImplementationOnce(() => {
      throw new Error("WebGL indisponible");
    });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={onClose} />);

    // Le message doit apparaître, et la modale ne doit pas rester bloquée.
    expect(await screen.findByText(/n'a pas pu être chargée/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revenir à l'annonce" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("affiche l'erreur quand l'image 360 est introuvable, sans construire PSV", async () => {
    // Une image 404 fait échouer PSV dans une promesse que rien n'attend :
    // écran noir + `unhandledRejection`. C'est pourquoi l'image est vérifiée
    // en amont, et pourquoi PSV ne doit même pas être instancié ici.
    stubImageLoading(false);
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={onClose} />);

    expect(await screen.findByText(/n'a pas pu être chargée/)).toBeInTheDocument();
    expect(viewerCtor).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Revenir à l'annonce" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("propose de fermer malgré l'échec : l'utilisateur n'est jamais piégé", async () => {
    stubImageLoading(false);
    render(<PanoramaViewer panorama={panorama} label="Chambre 12" onClose={() => {}} />);

    expect(await screen.findByRole("button", { name: "Fermer la visite 360°" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recentrer la vue" })).not.toBeInTheDocument();
  });
});
