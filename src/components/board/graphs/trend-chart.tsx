"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { formatMonthLabel } from "../lib/format";

export type TrendPoint = {
  month: string;
  contacts: number;
  studies: number;
};

const SERIES = [
  { key: "contacts" as const, label: "Contacts", coreVar: "var(--tone-sky-core)" },
  { key: "studies" as const, label: "Studies", coreVar: "var(--tone-amber-core)" },
];

/**
 * Contacts vs studies over the last months: two 2px ink lines with a legend,
 * direct end-labels, hover markers, and a tooltip. Grid and axes stay
 * recessive hairlines; every text label wears ink, never the series color
 * alone.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((point) => [point.contacts, point.studies]));

  // Percentage-space coordinates; the SVG stretches, strokes don't.
  const xFor = (index: number) =>
    data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
  const yFor = (value: number) => 92 - (value / max) * 80;

  function pointsFor(key: "contacts" | "studies") {
    return data.map((point, index) => `${xFor(index)},${yFor(point[key])}`).join(" ");
  }

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const index = Math.round(ratio * (data.length - 1));

    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Legend — identity is never color-alone: chip + ink label. */}
      <div className="flex items-center gap-4">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full"
              style={{ background: series.coreVar }}
            />
            <span className="t-meta-sm text-ink-3">{series.label}</span>
          </span>
        ))}
      </div>

      <div
        className="relative h-44 w-full"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={handleMove}
      >
        <svg
          aria-hidden
          className="absolute inset-0 size-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {/* Recessive hairline grid */}
          {[92, 52, 12].map((y) => (
            <line
              key={y}
              stroke="var(--sd-line)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={100}
              y1={y}
              y2={y}
            />
          ))}
          {hoverIndex !== null ? (
            <line
              stroke="var(--sd-line-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={8}
              y2={94}
            />
          ) : null}
          {SERIES.map((series) => (
            <polyline
              key={series.key}
              fill="none"
              points={pointsFor(series.key)}
              stroke={series.coreVar}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Markers as HTML so they stay circular under the stretched SVG. */}
        {data.map((point, index) =>
          SERIES.map((series) => (
            <span
              key={`${series.key}-${point.month}`}
              aria-hidden
              className={cn(
                "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-opacity",
                hoverIndex === index ? "opacity-100" : "opacity-0"
              )}
              style={{
                left: `${xFor(index)}%`,
                top: `${yFor(point[series.key])}%`,
                background: series.coreVar,
              }}
            />
          ))
        )}

        {/* Tooltip */}
        {hovered && hoverIndex !== null ? (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-(--sd-r-sm) border border-line bg-surface-raised px-2.5 py-1.5 shadow-(--sd-shadow-2)"
            style={{
              left: `clamp(3.5rem, ${xFor(hoverIndex)}%, calc(100% - 3.5rem))`,
            }}
          >
            <p className="t-meta-sm whitespace-nowrap text-ink-3">
              {formatMonthLabel(hovered.month)}
            </p>
            <p className="t-meta whitespace-nowrap text-ink">
              {hovered.contacts} contact{hovered.contacts === 1 ? "" : "s"} ·{" "}
              {hovered.studies} stud{hovered.studies === 1 ? "y" : "ies"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Mono month axis */}
      <div className="flex justify-between">
        {data.map((point) => (
          <span key={point.month} className="t-meta-sm text-ink-4">
            {formatMonthLabel(point.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
