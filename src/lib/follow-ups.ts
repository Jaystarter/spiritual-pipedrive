/**
 * Shared "needs follow-up" rule.
 *
 * This is the single source of truth for the overdue computation that both the
 * client board (`getFollowUpItems` in board.tsx) and the daily reminder cron use.
 * Keep the threshold and activity derivation identical so the email/push digest
 * matches exactly what a teacher sees in the app.
 *
 * The rule: a contact is "quiet" for N days when their most recent activity
 * (creation, last contact, any logged event except assignments, or any study)
 * is at least FOLLOW_UP_QUIET_DAYS old. No stage is excluded — the board flags
 * every visible contact past the threshold.
 */

export const FOLLOW_UP_QUIET_DAYS = 3;

const DAY_MS = 86_400_000;

export type ActivitySnapshot = {
  label: string;
  value: string;
};

export type FollowUpEventLike = {
  event_type: string;
  title: string;
  created_at: string;
};

export type FollowUpStudyLike = {
  studied_at: string | null;
  created_at: string;
};

export type FollowUpPersonLike<
  TStudy extends FollowUpStudyLike = FollowUpStudyLike,
  TEvent extends FollowUpEventLike = FollowUpEventLike,
> = {
  created_at: string;
  last_contacted_at: string | null;
  events: TEvent[];
  studies: TStudy[];
};

export type FollowUpStatus = {
  latestActivity: ActivitySnapshot;
  daysQuiet: number;
  isOverdue: boolean;
};

export type FollowUpOptions<TStudy extends FollowUpStudyLike> = {
  /** Reference time used to measure how long a contact has been quiet. */
  now?: number;
  /** Resolves the human-readable label for a study activity (cosmetic only). */
  studyLabel?: (study: TStudy) => string;
};

/**
 * Builds the list of candidate activities for a person, mirroring the order the
 * board uses (created, contacted, events, studies) so tie-breaking is identical.
 */
export function getActivityCandidates<
  TStudy extends FollowUpStudyLike,
  TEvent extends FollowUpEventLike,
>(
  person: FollowUpPersonLike<TStudy, TEvent>,
  studyLabel?: (study: TStudy) => string
): ActivitySnapshot[] {
  const candidates: Array<{ label: string; value: string | null }> = [
    { label: "Created", value: person.created_at },
    { label: "Contacted", value: person.last_contacted_at },
    ...person.events
      .filter((event) => event.event_type !== "assigned")
      .map((event) => ({
        label: event.title || "Activity logged",
        value: event.created_at,
      })),
    ...person.studies.map((study) => ({
      label: studyLabel ? studyLabel(study) : "Study",
      value: study.studied_at ?? study.created_at,
    })),
  ];

  return candidates.filter((item): item is ActivitySnapshot => Boolean(item.value));
}

/**
 * Returns the most recent activity snapshot for a person. Ties keep the earlier
 * candidate (matching the board's reduce semantics).
 */
export function getLatestActivity<
  TStudy extends FollowUpStudyLike,
  TEvent extends FollowUpEventLike,
>(
  person: FollowUpPersonLike<TStudy, TEvent>,
  studyLabel?: (study: TStudy) => string
): ActivitySnapshot {
  const candidates = getActivityCandidates(person, studyLabel);
  const [first, ...rest] = candidates;

  if (!first) {
    // created_at is always present in practice; fall back defensively.
    return { label: "Created", value: person.created_at };
  }

  return rest.reduce((latest, item) => {
    const latestTime = Date.parse(latest.value);
    const itemTime = Date.parse(item.value);

    if (Number.isNaN(itemTime)) {
      return latest;
    }

    return Number.isNaN(latestTime) || itemTime > latestTime ? item : latest;
  }, first);
}

/** Whole days elapsed since `value` relative to `now`. Invalid dates count as 0. */
export function daysSince(value: string, now: number = Date.now()): number {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

/** Full follow-up status (latest activity, days quiet, overdue flag) for a person. */
export function getFollowUpStatus<
  TStudy extends FollowUpStudyLike,
  TEvent extends FollowUpEventLike,
>(
  person: FollowUpPersonLike<TStudy, TEvent>,
  options: FollowUpOptions<TStudy> = {}
): FollowUpStatus {
  const { now = Date.now(), studyLabel } = options;
  const latestActivity = getLatestActivity(person, studyLabel);
  const daysQuiet = daysSince(latestActivity.value, now);

  return {
    latestActivity,
    daysQuiet,
    isOverdue: daysQuiet >= FOLLOW_UP_QUIET_DAYS,
  };
}

/** Convenience predicate for the cron: is this contact overdue for a follow-up? */
export function isFollowUpOverdue<
  TStudy extends FollowUpStudyLike,
  TEvent extends FollowUpEventLike,
>(person: FollowUpPersonLike<TStudy, TEvent>, now: number = Date.now()): boolean {
  return getFollowUpStatus(person, { now }).isOverdue;
}
