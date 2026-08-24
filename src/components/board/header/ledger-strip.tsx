"use client";

import { useState, type ReactNode } from "react";
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

import type { GenderView } from "../lib/derive";
import {
  getStreak,
  getStudiesThisWeek,
  getWeeklyGoal,
  setWeeklyGoal,
} from "../lib/engagement";
import { CountUp } from "../primitives/count-up";

type LedgerStripProps = {
  people: BoardPerson[];
  activeProfile: BoardProfile | null;
  attentionCount: number;
  genderView: GenderView;
  onGenderViewChange: (view: GenderView) => void;
  onOpenGraphs: () => void;
  onOpenNotifications: () => void;
};

const GENDER_VIEWS: { id: GenderView; label: string }[] = [
  { id: "male", label: "Men" },
  { id: "female", label: "Women" },
  { id: "all", label: "Everyone" },
];

/** The lens: men, women, or everyone — one quiet segmented pill. */
function GenderViewSwitch({
  value,
  onChange,
}: {
  value: GenderView;
  onChange: (view: GenderView) => void;
}) {
  return (
    <div
      aria-label="Show men, women, or everyone"
      className="flex h-8 items-center gap-0.5 self-center rounded-(--sd-r-pill) border border-line bg-surface p-0.5"
      role="group"
    >
      {GENDER_VIEWS.map((option) => (
        <button
          key={option.id}
          aria-pressed={value === option.id}
          className={cn(
            "t-label rounded-(--sd-r-pill) px-2.5 py-1 transition-colors",
            value === option.id
              ? "bg-surface-sunken text-brand"
              : "text-ink-3 hover:text-ink"
          )}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** One vital sign: a figure breathing over a single quiet word. */
function Vital({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="flex h-11 items-end">{children}</span>
      <span className="t-meta-sm text-ink-4">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        className="flex min-w-0 flex-col items-center gap-1.5"
        onClick={onClick}
        title={hint}
        type="button"
      >
        {body}
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5" title={hint}>
      {body}
    </div>
  );
}

function Figure({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("t-display-lg tabular-nums leading-none", className)}>
      <CountUp value={value} />
    </span>
  );
}

/** The lamp: consecutive active days, the flame lit once today counts. */
function StreakVital({
  people,
  profileId,
}: {
  people: BoardPerson[];
  profileId: string;
}) {
  const streak = getStreak(people, profileId);

  return (
    <Vital
      label="Streak"
      hint={
        streak.litToday
          ? "The lamp is lit — you logged something today"
          : "Log anything today to keep the streak"
      }
    >
      <span className="flex items-end gap-1">
        <Figure
          value={streak.count}
          className={streak.count > 0 ? "text-ink" : "text-ink-3"}
        />
        <Flame
          className={cn(
            "mb-0.5 size-4 transition-colors",
            streak.litToday
              ? "text-brand [filter:drop-shadow(0_0_4px_color-mix(in_oklch,var(--sd-accent)_55%,transparent))]"
              : "text-ink-4"
          )}
          fill={streak.litToday ? "currentColor" : "none"}
        />
      </span>
    </Vital>
  );
}

/** The week's course: an arc filling toward the goal; tap to change it. */
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
          aria-label={`This week: ${done} of ${goal} studies. Tap to change the goal.`}
          className="flex min-w-0 flex-col items-center gap-1.5"
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
          <span className="t-meta-sm text-ink-4">Week</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <p className="t-meta-sm mb-2 text-ink-3">
          {done} of {goal} studies this week
        </p>
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
          Your weekly study goal. Kept on this device.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The vitals: one airy line of five figures, each over a single word.
 * No dividers, no long labels — the air between columns does the work.
 */
export function LedgerStrip({
  people,
  activeProfile,
  attentionCount,
  genderView,
  onGenderViewChange,
  onOpenGraphs,
  onOpenNotifications,
}: LedgerStripProps) {
  const activeCount =
    activeProfile?.active_contacts ??
    people.filter((person) => !person.archived_at && person.stage !== "archive").length;
  const baptizedThisMonth = activeProfile?.baptized_this_month ?? 0;

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-2 gap-y-4 sm:justify-start sm:gap-x-12">
      <Vital
        label="People"
        hint={
          activeProfile
            ? `${activeProfile.name}’s active contacts`
            : "Active contacts"
        }
      >
        <Figure value={activeCount} className="text-ink" />
      </Vital>

      <Vital label="Baptized" hint="Baptized this month">
        <Figure
          value={baptizedThisMonth}
          className={
            baptizedThisMonth > 0 ? "text-tone-green-ink" : "text-ink-3"
          }
        />
      </Vital>

      <Vital
        label="Waiting"
        hint="Contacts needing attention — tap to review"
        onClick={onOpenNotifications}
      >
        <Figure
          value={attentionCount}
          className={attentionCount > 0 ? "text-signal-urgent" : "text-ink-3"}
        />
      </Vital>

      {activeProfile ? (
        <>
          <StreakVital people={people} profileId={activeProfile.id} />
          <WeeklyGoalRing people={people} profileId={activeProfile.id} />
        </>
      ) : null}

      {/* The lens takes the right edge; on phones it gets its own line. */}
      <div className="order-last flex w-full justify-center sm:order-none sm:ml-auto sm:w-auto">
        <GenderViewSwitch value={genderView} onChange={onGenderViewChange} />
      </div>

      {/* On phones the Almanac lives in the bottom bar already. */}
      <Button
        className="t-meta hidden gap-1 self-end text-ink-3 underline-offset-4 hover:text-brand hover:underline sm:flex"
        onClick={onOpenGraphs}
        variant="ghost"
      >
        Data
        <ArrowUpRight className="size-3.5" />
      </Button>
    </section>
  );
}
