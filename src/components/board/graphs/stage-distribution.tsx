"use client";

import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { displayStageCopy } from "../lib/derive";
import { getToneStyle } from "../lib/stage-theme";
import { StageRibbon } from "../primitives/stage-ribbon";

export type StageCount = {
  stage: Stage;
  count: number;
};

/**
 * The stage report: one labeled row per stage, each bar in its own tone —
 * color follows the entity. Thin marks, flat baseline, rounded data end;
 * every row carries a visible mono value (identity and value never rely on
 * color alone).
 */
export function StageDistribution({ rows }: { rows: StageCount[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(({ stage, count }) => {
        const tone = getToneStyle(stage.tone);
        const share = total === 0 ? 0 : Math.round((count / total) * 100);

        return (
          <div key={stage.id} className="flex items-center gap-3" title={`${displayStageCopy(stage.label)}: ${count} (${share}%)`}>
            <span className="flex w-36 shrink-0 items-center gap-2 sm:w-44">
              <StageRibbon tone={stage.tone} size="chip" className="h-3.5 w-1.5" />
              <span className="t-body-sm truncate text-ink-2">
                {displayStageCopy(stage.label)}
              </span>
            </span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-r-[4px] bg-surface-sunken shadow-(--sd-shadow-well)">
              <span
                className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", tone.core)}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="t-meta w-16 shrink-0 text-right tabular-nums text-ink">
              {count}
              <span className="text-ink-4"> · {share}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Workers vs students: two labeled rows in the entities' established hues. */
export function LifeStatusReport({
  workers,
  students,
}: {
  workers: number;
  students: number;
}) {
  const max = Math.max(1, workers, students);
  const rows = [
    { key: "workers", label: "Gospel workers", count: workers, core: "bg-tone-amber" },
    { key: "students", label: "Bible students", count: students, core: "bg-tone-sky" },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <span className="t-body-sm w-36 shrink-0 truncate text-ink-2 sm:w-44">
            {row.label}
          </span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-r-[4px] bg-surface-sunken shadow-(--sd-shadow-well)">
            <span
              className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", row.core)}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="t-meta w-16 shrink-0 text-right tabular-nums text-ink">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
