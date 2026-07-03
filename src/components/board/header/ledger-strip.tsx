"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Flame } from "lucide-react";

import type { BoardPerson, BoardProfile } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  getStreak,
  getStudiesThisWeek,
  getWeeklyGoal,
  setWeeklyGoal,
} from "../lib/engagement";
import { CountUp } from "../primitives/count-up";
import { LedgerStat } from "../primitives/ledger-stat";

type LedgerStripProps = {
  people: BoardPerson[];
  activeProfile: BoardProfile | null;
  attentionCount: number;
  onOpenGraphs: () => void;
  onOpenNotifications: () => void;
};

function StripDivider() {
  return (
    <div
      aria-hidden
      className="h-10 w-px bg-gradient-to-b from-transparent via-line-strong to-transparent"
    />
  );
}

/** The lamp: consecutive active days. Lit when today already counts. */
function StreakStat({
  people,
  profileId,
}: {
  people: BoardPerson[];
  profileId: string;
}) {
  const streak = getStreak(people, profileId);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="t-meta-sm text-ink-3">Day streak</span>
      <span className="flex items-end gap-1.5">
        <span
          className={cn(
            "t-display-lg tabular-nums leading-none",
            streak.count > 0 ? "text-ink" : "text-ink-3"
          )}
        >
          <CountUp value={streak.count} />
        </span>
        <Flame
          className={cn(
            "mb-0.5 size-4 transition-colors",
            streak.litToday
              ? "text-brand [filter:drop-shadow(0_0_4px_color-mix(in_oklch,var(--sd-accent)_55%,transparent))]"
              : "text-ink-4"
          )}
          fill={streak.litToday ? "currentColor" : "none"}
          aria-label={
            streak.litToday
              ? "The lamp is lit — you logged something today"
              : "Log anything today to keep the streak"
          }
        />
      </span>
    </div>
  );
}

/** The week's course: an arc that fills as studies are logged toward the goal. */
function WeeklyGoalRing({
  people,
  profileId,
}: {
  people: BoardPerson[];
  profileId: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [goal, setGoalState] = useState(getWeeklyGoal);
  const done = getStudiesThisWeek(people, profileId);
  const fraction = Math.min(done / Math.max(goal, 1), 1);
  const reached = done >= goal;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Weekly studies: ${done} of ${goal}. Tap to change the goal.`}
          className="flex min-w-0 items-center gap-2.5 text-left"
          type="button"
        >
          <span className="relative inline-flex size-11 items-center justify-center">
            <svg aria-hidden className="size-11 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                fill="none"
                r={radius}
                stroke="var(--sd-line)"
                strokeWidth="3"
              />
              <motion.circle
                cx="20"
                cy="20"
                fill="none"
                r={radius}
                stroke={reached ? "var(--tone-green-core)" : "var(--sd-accent)"}
                strokeDasharray={circumference}
                strokeLinecap="round"
                strokeWidth="3"
                initial={false}
                animate={{ strokeDashoffset: circumference * (1 - fraction) }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
                }
              />
            </svg>
            <span
              className={cn(
                "t-meta-sm absolute tabular-nums",
                reached ? "text-tone-green-ink" : "text-ink-2"
              )}
            >
              {done}
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="t-meta-sm text-ink-3">This week</span>
            <span className="t-body-sm text-ink-2">
              {reached ? "Goal reached" : `of ${goal} studies`}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <p className="t-meta-sm mb-2 text-ink-3">Weekly study goal</p>
        <div className="flex items-center gap-1.5">
          {[3, 5, 7, 10].map((option) => (
            <button
              key={option}
              className={cn(
                "t-label flex-1 rounded-(--sd-r-sm) border border-line py-1.5 transition-colors hover:border-line-strong",
                goal === option && "border-brand text-brand"
              )}
              onClick={() => {
                setWeeklyGoal(option);
                setGoalState(option);
              }}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <p className="t-meta-sm mt-2 text-ink-4">
          Studies you log each week. Kept on this device.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The folio line under the masthead — now a living one: tallies count up,
 * the streak lamp burns, the week's ring fills toward the goal.
 */
export function LedgerStrip({
  people,
  activeProfile,
  attentionCount,
  onOpenGraphs,
  onOpenNotifications,
}: LedgerStripProps) {
  const activeCount =
    activeProfile?.active_contacts ??
    people.filter((person) => !person.archived_at && person.stage !== "archive").length;
  const baptizedThisMonth = activeProfile?.baptized_this_month ?? 0;

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex flex-wrap items-end gap-5 sm:gap-7">
        <LedgerStat
          label={activeProfile ? `${activeProfile.name}’s contacts` : "Active contacts"}
          value={<CountUp value={activeCount} />}
        />
        <StripDivider />
        <LedgerStat
          label="Baptized this month"
          value={<CountUp value={baptizedThisMonth} />}
          tone={baptizedThisMonth > 0 ? "joy" : "muted"}
        />
        <StripDivider />
        <button className="text-left" onClick={onOpenNotifications} type="button">
          <LedgerStat
            label="Needs attention"
            value={<CountUp value={attentionCount} />}
            tone={attentionCount > 0 ? "urgent" : "muted"}
          />
        </button>
        {activeProfile ? (
          <>
            <StripDivider />
            <StreakStat people={people} profileId={activeProfile.id} />
            <StripDivider />
            <WeeklyGoalRing people={people} profileId={activeProfile.id} />
          </>
        ) : null}
      </div>

      <Button
        className="t-meta gap-1 self-end text-ink-3 underline-offset-4 hover:text-brand hover:underline"
        onClick={onOpenGraphs}
        variant="ghost"
      >
        The Almanac
        <ArrowUpRight className="size-3.5" />
      </Button>
    </section>
  );
}
