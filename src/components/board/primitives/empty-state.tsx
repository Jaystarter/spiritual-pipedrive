import type { StageToneName } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { toneVars } from "../lib/stage-theme";
import { StageRibbon } from "./stage-ribbon";

/** A quiet well with the stage ribbon and a serif-italic line. */
export function EmptyState({
  tone,
  message,
  hint,
  className,
}: {
  tone?: StageToneName;
  message: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-(--sd-r-md) border border-dashed border-line bg-surface-sunken/60 px-4 py-6 text-center shadow-(--sd-shadow-well)",
        className
      )}
      style={{
        ...(tone ? toneVars(tone) : undefined),
        ...(tone
          ? {
              backgroundImage:
                "radial-gradient(60% 90% at 50% 0%, color-mix(in oklch, var(--tone) 6%, transparent), transparent)",
            }
          : undefined),
      }}
    >
      {tone ? <StageRibbon tone={tone} size="chip" /> : null}
      <p className="t-display-sm italic text-ink-3">{message}</p>
      {hint ? <p className="t-meta-sm text-ink-4">{hint}</p> : null}
    </div>
  );
}
