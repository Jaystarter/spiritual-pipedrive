import type { StageToneName } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { getToneStyle } from "../lib/stage-theme";

/**
 * The signature stage mark: a corner of spider silk spun in the stage's
 * tone. Three spokes anchor at the corner and three threads sag between
 * them. Reused on lanes, pickers, and steppers so stage identity reads
 * the same everywhere. The "sliver" size stays a plain silk edge bar
 * for cards and list rows.
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
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={cn("shrink-0", size === "full" ? "size-6" : "size-4", className)}
      style={{
        color: toneStyle.coreVar,
        filter: `drop-shadow(0 0 3px color-mix(in oklch, ${toneStyle.coreVar} 45%, transparent))`,
      }}
    >
      {/* Spokes from the anchor corner. */}
      <path d="M1 1 22.2 4.7 M1 1 16.2 16.2 M1 1 4.7 22.2" />
      {/* Silk threads, sagging toward the anchor. */}
      <path d="M9.9 2.6 Q7.6 4.4 7.4 7.4 Q4.4 7.6 2.6 9.9" />
      <path d="M16.3 3.7 Q12.3 6.9 12 12 Q6.9 12.3 3.7 16.3" />
      <path d="M22.2 4.7 Q16.6 9.1 16.2 16.2 Q9.1 16.6 4.7 22.2" />
    </svg>
  );
}
