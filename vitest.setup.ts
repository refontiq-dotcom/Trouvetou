import "@testing-library/jest-dom/vitest";

/**
 * jsdom n'implémente pas `IntersectionObserver`, alors que les composants du
 * catalogue utilisent `whileInView` de framer-motion. Sans ce stub, le rendu
 * d'une carte échoue avant même d'atteindre la logique testée.
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