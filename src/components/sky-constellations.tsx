import type { CSSProperties } from "react";

/**
 * The constellation layer: rendered once inside `.sky-bg` (layout.tsx).
 * A field of breathing stars, three drawn star-figures of the journey —
 * the Shepherd's Crook, the Fish, the Crown — drifting on decade-slow
 * loops, one bright star in the east, and two wanderers crossing the sky.
 *
 * Everything is deterministic (seeded scatter, no Math.random) so the
 * server and client render the same sky.
 */

type Constellation = {
  name: string;
  viewBox: string;
  width: number;
  height: number;
  points: Array<[number, number]>;
  segments: Array<[number, number]>;
  style: CSSProperties;
  drift: "c-drift-a" | "c-drift-b" | "c-drift-c";
};

const CONSTELLATIONS: Constellation[] = [
  {
    // The Shepherd's Crook — staff rising into a hooked head.
    name: "crook",
    viewBox: "0 0 17 46",
    width: 44,
    height: 119,
    points: [
      [15, 44],
      [14, 29],
      [13, 15],
      [12, 7],
      [8, 2],
      [3, 4],
      [1, 10],
    ],
    segments: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
    style: { left: "7%", top: "17%" },
    drift: "c-drift-a",
  },
  {
    // The Fish — two star-chains crossing at the tail.
    name: "fish",
    viewBox: "0 0 30 20",
    width: 116,
    height: 77,
    points: [
      [1, 10],
      [9, 3.5],
      [19, 6.5],
      [29, 16.5],
      [9, 16.5],
      [19, 13.5],
      [29, 3.5],
    ],
    segments: [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 4],
      [4, 5],
      [5, 6],
    ],
    style: { right: "6%", top: "9%" },
    drift: "c-drift-b",
  },
  {
    // The Crown — three peaks over a base line.
    name: "crown",
    viewBox: "0 0 28 22",
    width: 104,
    height: 82,
    points: [
      [1, 19],
      [4, 7],
      [9, 15],
      [14, 3],
      [19, 15],
      [24, 7],
      [27, 19],
    ],
    segments: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [0, 6],
    ],
    style: { left: "10%", bottom: "12%" },
    drift: "c-drift-c",
  },
];

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

      {CONSTELLATIONS.map((constellation) => (
        <svg
          key={constellation.name}
          className={`c-const ${constellation.drift}`}
          style={{
            ...constellation.style,
            width: constellation.width,
            height: constellation.height,
          }}
          viewBox={constellation.viewBox}
        >
          {constellation.segments.map(([from, to], i) => {
            const [x1, y1] = constellation.points[from];
            const [x2, y2] = constellation.points[to];

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                vectorEffect="non-scaling-stroke"
                style={{ animationDelay: `${(i * -2.3).toFixed(1)}s` }}
              />
            );
          })}
          {constellation.points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={0.8} />
          ))}
        </svg>
      ))}

      <span className="c-wanderer" />
      <span className="c-wanderer c-wanderer-2" />
    </div>
  );
}
