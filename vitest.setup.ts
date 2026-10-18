import "@testing-library/jest-dom/vitest";

/**
 * jsdom n'implémente pas `IntersectionObserver`, or `RoomCard` utilise
 * `whileInView` de framer-motion. Sans ce stub, le rendu de la carte échoue
 * avant même d'atteindre la logique 360°.
 *
 * Le stub signale immédiatement l'élément comme visible : les animations
 * d'entrée ne sont pas l'objet de ces tests, et les laisser en attente
 * rendrait les assertions instables.
 */
class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = IntersectionObserverStub;
}
