import { describe, expect, it } from "vitest";
import { normalizePanoramaTour } from "./panorama";

describe("normalizePanoramaTour", () => {
  it("removes links pointing to missing scenes", () => {
    const tour = normalizePanoramaTour({
      version: 1,
      startSceneId: "a",
      scenes: [
        { id: "a", name: "Chambre A", kind: "room", src: "https://cdn.test/a.webp" },
        { id: "b", name: "Couloir", kind: "corridor", src: "https://cdn.test/b.webp" },
      ],
      links: [
        { id: "ok", fromSceneId: "a", toSceneId: "b", yaw: 0, pitch: 0, label: "Couloir" },
        { id: "bad", fromSceneId: "a", toSceneId: "x", yaw: 0, pitch: 0, label: "Invalide" },
      ],
    });
    expect(tour.links).toHaveLength(1);
  });
});
