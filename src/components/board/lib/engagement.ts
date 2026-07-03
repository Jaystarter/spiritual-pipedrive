// The game layer's arithmetic — computed entirely from data the board
// already loads (events + studies authored by a profile). No schema, no
// server round-trips: streaks and goals are derived truths, not stored ones.
import type { BoardPerson } from "@/app/actions";

/** Local-time day stamp (YYYY-MM-DD) for grouping activity into days. */
function dayStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftedStamp(base: Date, offsetDays: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);

  return dayStamp(date);
}

/** Every local day on which this profile did anything (event or study). */
export function getActivityDays(people: BoardPerson[], profileId: string) {
  const days = new Set<string>();

  for (const person of people) {
    for (const event of person.events) {
      if (event.actor_profile_id === profileId) {
        const time = new Date(event.created_at);

        if (!Number.isNaN(time.getTime())) {
          days.add(dayStamp(time));
        }
      }
    }

    for (const study of person.studies) {
      if (study.actor_profile_id === profileId) {
        const time = new Date(study.studied_at ?? study.created_at);

        if (!Number.isNaN(time.getTime())) {
          days.add(dayStamp(time));
        }
      }
    }
  }

  return days;
}

export type Streak = {
  /** Consecutive active days ending today (or yesterday, grace period). */
  count: number;
  /** True once something was logged today — the flame is lit. */
  litToday: boolean;
};

/**
 * The lamp streak: consecutive days with any logged activity. A streak
 * survives until a full day passes with nothing — so yesterday's streak is
 * still alive this morning, waiting to be extended.
 */
export function getStreak(people: BoardPerson[], profileId: string): Streak {
  if (!profileId) {
    return { count: 0, litToday: false };
  }

  const days = getActivityDays(people, profileId);
  const now = new Date();
  const litToday = days.has(dayStamp(now));

  // Anchor on today if lit, else yesterday (grace); otherwise no streak.
  const anchorOffset = litToday ? 0 : -1;

  if (!litToday && !days.has(shiftedStamp(now, -1))) {
    return { count: 0, litToday: false };
  }

  let count = 0;

  while (days.has(shiftedStamp(now, anchorOffset - count))) {
    count += 1;
  }

  return { count, litToday };
}

/** Studies this profile logged in the current week (Sunday-start, local). */
export function getStudiesThisWeek(people: BoardPerson[], profileId: string) {
  if (!profileId) {
    return 0;
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  let count = 0;

  for (const person of people) {
    for (const study of person.studies) {
      if (study.actor_profile_id !== profileId) {
        continue;
      }

      const time = new Date(study.studied_at ?? study.created_at);

      if (!Number.isNaN(time.getTime()) && time >= weekStart) {
        count += 1;
      }
    }
  }

  return count;
}

const WEEKLY_GOAL_KEY = "sd-weekly-goal";
export const DEFAULT_WEEKLY_GOAL = 5;

export function getWeeklyGoal() {
  if (typeof window === "undefined") {
    return DEFAULT_WEEKLY_GOAL;
  }

  try {
    const stored = Number(window.localStorage.getItem(WEEKLY_GOAL_KEY));

    return Number.isFinite(stored) && stored >= 1 && stored <= 99
      ? stored
      : DEFAULT_WEEKLY_GOAL;
  } catch {
    return DEFAULT_WEEKLY_GOAL;
  }
}

export function setWeeklyGoal(goal: number) {
  try {
    window.localStorage.setItem(WEEKLY_GOAL_KEY, String(goal));
  } catch {
    // localStorage unavailable — the goal simply stays at the default.
  }
}
