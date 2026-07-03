import type { StageToneName } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { getToneStyle } from "../lib/stage-theme";
import { WebGlyph } from "./web-glyph";

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
    <WebGlyph
      className={cn("shrink-0", size === "full" ? "size-6" : "size-4", className)}
      style={{
        color: toneStyle.coreVar,
        filter: `drop-shadow(0 0 3px color-mix(in oklch, ${toneStyle.coreVar} 45%, transparent))`,
      }}
    />
  );
}
