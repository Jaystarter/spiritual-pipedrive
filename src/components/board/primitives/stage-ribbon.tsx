import type { StageToneName } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { getToneStyle } from "../lib/stage-theme";

/**
 * The signature stage mark: a miniature diamond seal in the stage's
 * tone, kin to the logo seal, the Path milestones, and the FAB. Reused
 * on lanes, pickers, and steppers so stage identity reads the same
 * everywhere. The "sliver" size stays a plain edge bar for cards and
 * list rows.
 */
export function StageRibbon({
  tone,
  size = "chip",
  className,
}: {
  tone: StageToneName;
  size?: "sliver" | "chip" | "full";
  className?: string;
}) {
  const toneStyle = getToneStyle(tone);

  if (size === "sliver") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block w-[3px] shrink-0 self-stretch rounded-full",
          toneStyle.core,
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        size === "full" ? "size-5" : "size-3.5",
        className
      )}
      style={{ color: toneStyle.coreVar }}
    >
      <span
        className="absolute inset-0 rotate-45 rounded-[2px] border border-current opacity-70"
        style={{
          boxShadow: "0 0 6px color-mix(in oklch, currentcolor 30%, transparent)",
        }}
      />
      <span
        className="size-1 rounded-full bg-current"
        style={{
          boxShadow: "0 0 6px color-mix(in oklch, currentcolor 70%, transparent)",
        }}
      />
    </span>
  );
}
