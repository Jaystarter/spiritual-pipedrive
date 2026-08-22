import type { BoardPerson } from "@/app/actions";
import { FOLLOW_UP_QUIET_DAYS, isAcknowledged } from "@/lib/follow-ups";
import { cn } from "@/lib/utils";

import {
  STALE_CONTACT_GLOW_DAYS,
  getLatestActivitySnapshot,
  getLatestContactReaction,
  isReactionOverdue,
} from "../lib/derive";
import { daysSinceDate, formatDate } from "../lib/format";

export type UrgencyLevel = "calm" | "wane" | "urgent";

export type Urgency = {
  level: UrgencyLevel;
  daysQuiet: number;
  missedFollowUp: boolean;
  reactionOverdue: boolean;
  acknowledged: boolean;
  acknowledgedUntil: string | null;
};

/**
 * THE single home of the card attention logic. Replaces the three overlapping
 * legacy signals (stale red glow ≥7d, reaction-overdue tint, MISSED chip):
 *  - calm    quiet < 3 days, or acknowledged
 *  - wane    quiet ≥ 3 days OR an unanswered text/call is ≥3 days old
 *  - urgent  quiet ≥ 7 days OR a set follow-up date has passed
 *
 * Acknowledgement quiets the *signal* only. `daysQuiet` is reported untouched,
 * so the card still says how long it has really been. Once the follow-up date
 * passes the promise is broken and `missedFollowUp` escalates it to urgent.
 */
export function getUrgency(person: BoardPerson): Urgency {
  const daysQuiet = daysSinceDate(getLatestActivitySnapshot(person).value);
  const reactionOverdue = isReactionOverdue(getLatestContactReaction(person.events));
  const followUpAt = person.next_follow_up_at
    ? Date.parse(person.next_follow_up_at)
    : Number.NaN;
  const missedFollowUp = !Number.isNaN(followUpAt) && followUpAt < Date.now();
  const acknowledged = isAcknowledged(person);

  const level: UrgencyLevel = acknowledged
    ? "calm"
    : daysQuiet >= STALE_CONTACT_GLOW_DAYS || missedFollowUp
      ? "urgent"
      : daysQuiet >= FOLLOW_UP_QUIET_DAYS || reactionOverdue
        ? "wane"
        : "calm";

  return {
    level,
    daysQuiet,
    missedFollowUp,
    reactionOverdue,
    acknowledged,
    acknowledgedUntil: acknowledged ? person.next_follow_up_at : null,
  };
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

  if (urgency.acknowledged) {
    parts.push(`acknowledged, following up ${formatDate(urgency.acknowledgedUntil)}`);
  }

  if (urgency.missedFollowUp) {
    parts.push("a planned follow-up date has passed");
  }

  if (urgency.reactionOverdue) {
    parts.push("an unanswered text or call is waiting");
  }

  return parts.join(" · ");
}

/**
 * The acknowledgement mark: the house diamond seal, in the accent that means
 * "the app's hand" (crimson in Daybreak, gold in Vespers). Same construction as
 * StageRibbon's seal, driven entirely by `currentcolor`.
 */
function AcknowledgedSeal() {
  return (
    <span
      aria-hidden
      className="relative inline-flex size-2.5 shrink-0 items-center justify-center"
      style={{ color: "var(--sd-accent)" }}
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

/**
 * A waning-moon dot that fills as quiet days pass, beside a mono day count.
 * A halo ring marks a missed follow-up date; an accent seal marks an
 * acknowledgement. The day count is the same number either way: acknowledging
 * quiets the signal, it never rewrites the history.
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
  const description = describeUrgency(urgency);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
      title={description}
    >
      {/* The state is never colour alone: it is named here for assistive tech. */}
      <span className="sr-only">{description}</span>
      {urgency.acknowledged ? (
        <AcknowledgedSeal />
      ) : (
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
      )}
      {showLabel ? (
        <span
          aria-hidden
          className={cn(
            "t-meta-sm tabular-nums",
            urgency.acknowledged ? "text-ink-4" : LEVEL_TEXT[urgency.level]
          )}
        >
          {urgency.daysQuiet}d
        </span>
      ) : null}
    </span>
  );
}
