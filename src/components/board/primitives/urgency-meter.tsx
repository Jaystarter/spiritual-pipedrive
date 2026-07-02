import type { BoardPerson } from "@/app/actions";
import { FOLLOW_UP_QUIET_DAYS } from "@/lib/follow-ups";
import { cn } from "@/lib/utils";

import {
  STALE_CONTACT_GLOW_DAYS,
  getLatestActivitySnapshot,
  getLatestContactReaction,
  isReactionOverdue,
} from "../lib/derive";
import { daysSinceDate } from "../lib/format";

export type UrgencyLevel = "calm" | "wane" | "urgent";

export type Urgency = {
  level: UrgencyLevel;
  daysQuiet: number;
  missedFollowUp: boolean;
  reactionOverdue: boolean;
};

/**
 * THE single home of the card attention logic. Replaces the three overlapping
 * legacy signals (stale red glow ≥7d, reaction-overdue tint, MISSED chip):
 *  - calm    quiet < 3 days
 *  - wane    quiet ≥ 3 days OR an unanswered text/call is ≥3 days old
 *  - urgent  quiet ≥ 7 days OR a set follow-up date has passed
 */
export function getUrgency(person: BoardPerson): Urgency {
  const daysQuiet = daysSinceDate(getLatestActivitySnapshot(person).value);
  const reactionOverdue = isReactionOverdue(getLatestContactReaction(person.events));
  const followUpAt = person.next_follow_up_at
    ? Date.parse(person.next_follow_up_at)
    : Number.NaN;
  const missedFollowUp = !Number.isNaN(followUpAt) && followUpAt < Date.now();

  const level: UrgencyLevel =
    daysQuiet >= STALE_CONTACT_GLOW_DAYS || missedFollowUp
      ? "urgent"
      : daysQuiet >= FOLLOW_UP_QUIET_DAYS || reactionOverdue
        ? "wane"
        : "calm";

  return { level, daysQuiet, missedFollowUp, reactionOverdue };
}

const LEVEL_VAR: Record<UrgencyLevel, string> = {
  calm: "var(--sd-signal-calm)",
  wane: "var(--sd-signal-wane)",
  urgent: "var(--sd-signal-urgent)",
};

const LEVEL_TEXT: Record<UrgencyLevel, string> = {
  calm: "text-signal-calm",
  wane: "text-signal-wane",
  urgent: "text-signal-urgent",
};

export function describeUrgency(urgency: Urgency): string {
  const parts = [
    `${urgency.daysQuiet} day${urgency.daysQuiet === 1 ? "" : "s"} since the last activity`,
  ];

  if (urgency.missedFollowUp) {
    parts.push("a planned follow-up date has passed");
  }

  if (urgency.reactionOverdue) {
    parts.push("an unanswered text or call is waiting");
  }

  return parts.join(" · ");
}

/**
 * A waning-moon dot that fills as quiet days pass, beside a mono day count.
 * A halo ring marks a missed follow-up date.
 */
export function UrgencyMeter({
  person,
  className,
  showLabel = true,
}: {
  person: BoardPerson;
  className?: string;
  showLabel?: boolean;
}) {
  const urgency = getUrgency(person);
  const color = LEVEL_VAR[urgency.level];
  const fillFraction = Math.min(urgency.daysQuiet / STALE_CONTACT_GLOW_DAYS, 1);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
      title={describeUrgency(urgency)}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-2.5 rounded-full",
          urgency.missedFollowUp && "ring-2 ring-offset-1 ring-offset-surface"
        )}
        style={{
          background: `conic-gradient(${color} ${Math.round(fillFraction * 360)}deg, color-mix(in oklch, ${color} 22%, transparent) 0)`,
          ...(urgency.missedFollowUp
            ? { ["--tw-ring-color" as string]: `color-mix(in oklch, ${color} 45%, transparent)` }
            : undefined),
        }}
      />
      {showLabel ? (
        <span className={cn("t-meta-sm tabular-nums", LEVEL_TEXT[urgency.level])}>
          {urgency.daysQuiet}d
        </span>
      ) : null}
    </span>
  );
}
