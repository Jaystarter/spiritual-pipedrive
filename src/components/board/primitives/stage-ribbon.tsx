import type { StageToneName } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { getToneStyle } from "../lib/stage-theme";

const SIZE_CLASSES = {
  /** 3px edge marker on cards and list rows. */
  sliver: "w-[3px] self-stretch rounded-full",
  /** Small bookmark beside compact labels. */
  chip: "h-5 w-2",
  /** Full bookmark hanging beside lane titles. */
  full: "h-7 w-2.5",
} as const;

// The forked ribbon tail — like a bookmark ribbon in a well-worn Bible.
const FORK_CLIP = "polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 4px), 0 100%)";

/**
 * The signature stage mark: a ribbon bookmark in the stage's tone. Reused on
 * lanes, cards, pickers, and steppers so stage identity reads the same
 * everywhere.
 */
export function StageRibbon({
  tone,
  size = "chip",
  className,
}: {
  tone: StageToneName;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", toneStyle.core, SIZE_CLASSES[size], className)}
      style={size === "sliver" ? undefined : { clipPath: FORK_CLIP }}
    />
  );
}
