"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { onCelebrate, type CelebrationBurst } from "../lib/celebrate";

type ActiveBurst = CelebrationBurst & { id: number };

const GOLD_COLORS = [
  "var(--sd-accent-hi)",
  "var(--sd-accent)",
  "var(--sd-accent-lo)",
];

// Deterministic pseudo-random spread per particle index — playful but
// hydration-safe and identical every render.
function particleVector(index: number, total: number) {
  const angle = (index / total) * Math.PI * 2 + (index % 3) * 0.35;
  const distance = 42 + ((index * 37) % 44);

  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance - 24,
    rotation: ((index * 97) % 180) - 90,
    size: 4 + ((index * 13) % 5),
    delay: ((index * 7) % 4) * 0.02,
  };
}

/**
 * The joy layer: renders short-lived particle bursts fired through the
 * celebrate() bus — logging a study, a baptism, a streak extended. Sits
 * above everything, ignores the pointer, respects reduced motion.
 */
export function CelebrationLayer() {
  const [bursts, setBursts] = useState<ActiveBurst[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let nextId = 1;

    return onCelebrate((burst) => {
      const id = nextId;
      nextId += 1;

      setBursts((current) => [...current.slice(-3), { ...burst, id }]);
      window.setTimeout(() => {
        setBursts((current) => current.filter((item) => item.id !== id));
      }, 900);
    });
  }, []);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-(--z-toast)"
    >
      <AnimatePresence>
        {bursts.map((burst) => {
          const colors = burst.colors ?? GOLD_COLORS;
          const count = burst.intensity === "grand" ? 22 : 12;
          const originX = burst.x ?? window.innerWidth / 2;
          const originY = burst.y ?? window.innerHeight * 0.35;

          return (
            <span key={burst.id}>
              {Array.from({ length: count }, (_, index) => {
                const vector = particleVector(index, count);
                const scale = burst.intensity === "grand" ? 1.6 : 1;

                return (
                  <motion.span
                    key={index}
                    className="absolute rounded-[1px]"
                    style={{
                      left: originX,
                      top: originY,
                      width: vector.size,
                      height: vector.size * 0.6,
                      background: colors[index % colors.length],
                    }}
                    initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                    animate={{
                      opacity: 0,
                      x: vector.dx * scale,
                      y: vector.dy * scale + 60,
                      rotate: vector.rotation,
                      scale: 0.6,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.8,
                      delay: vector.delay,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                );
              })}
            </span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
