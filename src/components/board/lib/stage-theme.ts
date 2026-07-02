// SINGLE SOURCE for how a stage tone becomes color on screen. The six tones
// map to real hues (defined per theme as --tone-* variables in globals.css),
// forming the journey arc: amber dawn → sky → indigo → violet → emerald →
// living green. Everything that colors by stage reads from here.
import type { CSSProperties } from "react";

import type { StageToneName } from "@/lib/stages";

export type ToneStyle = {
  /** Solid tone fill — ribbons, dots, insertion lines. */
  core: string;
  /** Tone-colored text that passes contrast on --sd-surface. */
  ink: string;
  /** Faint tone wash for hover/drop states. */
  wash: string;
  /** Hairline in the tone. */
  rule: string;
  /** Inset focus/drop ring in the tone. */
  ring: string;
  /** Raw CSS var for the core color (for inline styles / SVG). */
  coreVar: string;
};

export const TONE_STYLES: Record<StageToneName, ToneStyle> = {
  amber: {
    core: "bg-tone-amber",
    ink: "text-tone-amber-ink",
    wash: "bg-tone-amber/10",
    rule: "border-tone-amber/35",
    ring: "ring-tone-amber/45",
    coreVar: "var(--tone-amber-core)",
  },
  sky: {
    core: "bg-tone-sky",
    ink: "text-tone-sky-ink",
    wash: "bg-tone-sky/10",
    rule: "border-tone-sky/35",
    ring: "ring-tone-sky/45",
    coreVar: "var(--tone-sky-core)",
  },
  indigo: {
    core: "bg-tone-indigo",
    ink: "text-tone-indigo-ink",
    wash: "bg-tone-indigo/10",
    rule: "border-tone-indigo/35",
    ring: "ring-tone-indigo/45",
    coreVar: "var(--tone-indigo-core)",
  },
  violet: {
    core: "bg-tone-violet",
    ink: "text-tone-violet-ink",
    wash: "bg-tone-violet/10",
    rule: "border-tone-violet/35",
    ring: "ring-tone-violet/45",
    coreVar: "var(--tone-violet-core)",
  },
  emerald: {
    core: "bg-tone-emerald",
    ink: "text-tone-emerald-ink",
    wash: "bg-tone-emerald/10",
    rule: "border-tone-emerald/35",
    ring: "ring-tone-emerald/45",
    coreVar: "var(--tone-emerald-core)",
  },
  green: {
    core: "bg-tone-green",
    ink: "text-tone-green-ink",
    wash: "bg-tone-green/10",
    rule: "border-tone-green/35",
    ring: "ring-tone-green/45",
    coreVar: "var(--tone-green-core)",
  },
};

export function getToneStyle(tone: StageToneName): ToneStyle {
  return TONE_STYLES[tone] ?? TONE_STYLES.sky;
}

/**
 * Inline style that arms the .tone-* utilities (tone-wash-head,
 * tone-wash-card, tone-border) with this stage's hue.
 */
export function toneVars(tone: StageToneName): CSSProperties {
  return { "--tone": getToneStyle(tone).coreVar } as CSSProperties;
}
