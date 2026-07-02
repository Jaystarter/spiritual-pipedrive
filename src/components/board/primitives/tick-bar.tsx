import type { StageToneName } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { getToneStyle } from "../lib/stage-theme";

/**
 * The progress rule: one rounded tick per study in the catalog, filling in
 * the stage tone as studies are logged. Empty ticks carry a whisper of the
 * same tone (not gray) so the rule reads as one object; fills transition so
 * a newly logged study visibly arrives.
 */
export function TickBar({
  total,
  completed,
  tone,
  className,
}: {
  total: number;
  completed: Set<number>;
  tone: StageToneName;
  className?: string;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <div className={cn("flex items-stretch gap-[3px]", className)}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className="h-2 min-w-0 flex-1 rounded-full transition-colors duration-(--dur-slow)"
          style={{
            background: completed.has(index + 1)
              ? toneStyle.coreVar
              : `color-mix(in oklch, ${toneStyle.coreVar} 14%, var(--sd-surface-sunken))`,
          }}
        />
      ))}
    </div>
  );
}
