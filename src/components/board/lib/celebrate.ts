"use client";

// A featherweight celebration bus: anything can fire a burst; the
// CelebrationLayer at the root listens and renders the particles. No
// dependencies, no context — module-level pub/sub is enough for confetti.

export type CelebrationBurst = {
  /** Viewport coordinates of the burst origin. Omit for center-stage. */
  x?: number;
  y?: number;
  /** Particle colors — defaults to gold; pass tone vars for stage flavor. */
  colors?: string[];
  /** Rough particle count (capped by the layer). */
  intensity?: "small" | "grand";
};

type Listener = (burst: CelebrationBurst) => void;

const listeners = new Set<Listener>();

export function celebrate(burst: CelebrationBurst = {}) {
  listeners.forEach((listener) => listener(burst));
}

export function onCelebrate(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Convenience: burst from the center of a DOM element (e.g. the button pressed). */
export function celebrateFrom(element: HTMLElement | null, burst: CelebrationBurst = {}) {
  if (!element) {
    celebrate(burst);
    return;
  }

  const rect = element.getBoundingClientRect();
  celebrate({
    ...burst,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
}
