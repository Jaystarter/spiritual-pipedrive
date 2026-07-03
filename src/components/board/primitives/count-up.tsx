"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

/**
 * A numeral that counts to its value — the ledger's tallies feel earned,
 * not printed. Falls back to a static number under reduced motion.
 */
export function CountUp({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));
  const previousRef = useRef(value);

  useEffect(() => {
    if (previousRef.current === value) {
      return;
    }

    previousRef.current = value;
    const controls = animate(motionValue, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    });

    return () => controls.stop();
  }, [motionValue, value]);

  if (prefersReducedMotion) {
    return <>{value}</>;
  }

  return <motion.span>{rounded}</motion.span>;
}
