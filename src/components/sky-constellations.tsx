import type { CSSProperties } from "react";

/**
 * The sky layer: rendered once inside `.sky-bg` (layout.tsx). A field of
 * breathing stars, one bright star in the east, three slowly turning
 * spirit orbs, and two wanderers crossing the whole sky.
 *
 * Everything is deterministic (seeded scatter, no Math.random) so the
 * server and client render the same sky.
 */

/** Seeded hash → [0,1): the same sky every render, server and client. */
function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;

  return x - Math.floor(x);
}

const SCATTER = Array.from({ length: 36 }, (_, i) => ({
  left: `${(2 + seeded(i, 1) * 96).toFixed(2)}%`,
  top: `${(3 + seeded(i, 2) * 93).toFixed(2)}%`,
  size: `${(1.4 + seeded(i, 3) * 1.7).toFixed(2)}px`,
  delay: `${(seeded(i, 4) * -12).toFixed(2)}s`,
  duration: `${(4 + seeded(i, 5) * 7).toFixed(2)}s`,
}));

export function SkyConstellations() {
  return (
    <div aria-hidden className="const-field">
      {SCATTER.map((star, i) => (
        <span
          key={i}
          className="c-star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}

      <span
        className="c-star c-star-east"
        style={{ right: "13%", bottom: "22%" }}
      />

      {/* Spirit orbs: hand-scribbled glow spirals, each turning at its
          own pace — drawn once, spun by CSS. */}
      {ORBS.map((orb, i) => (
        <svg
          key={i}
          className={`c-orb ${orb.spin}`}
          style={{
            ...orb.style,
            width: orb.size,
            height: orb.size,
          }}
          viewBox="0 0 100 100"
        >
          <path d="M50 44c5-1 9 3 9 8 0 6-6 10-12 9-8-1-13-9-10-17 3-9 13-13 22-9 11 4 15 17 10 27-6 12-21 16-32 10-13-8-17-25-8-37" />
          <circle cx="50" cy="49" r="1.6" />
        </svg>
      ))}

      <span className="c-wanderer" />
      <span className="c-wanderer c-wanderer-2" />
    </div>
  );
}

const ORBS: Array<{
  style: CSSProperties;
  size: number;
  spin: "" | "c-orb-2" | "c-orb-3";
}> = [
  { style: { right: "9%", top: "28%" }, size: 120, spin: "" },
  { style: { left: "5%", top: "56%" }, size: 84, spin: "c-orb-2" },
  { style: { right: "27%", bottom: "6%" }, size: 64, spin: "c-orb-3" },
];
