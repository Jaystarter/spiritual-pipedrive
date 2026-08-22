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
 *
 * Acknowledgement sits *beside* that rule rather than inside it. Saying "I have
 * seen this person" silences them for a while, but it is not contact, so it must
 * never move the quiet clock: `daysQuiet` keeps climbing and keeps telling the
 * truth while `isOverdue` goes false. That is why the 'acknowledged' event is
 * filtered out of the activity candidates below, exactly like 'assigned'.
 */

export const FOLLOW_UP_QUIET_DAYS = 3;

/**
 * How long one acknowledgement buys. Deliberately the same length as the quiet
 * threshold so the app keeps a single rhythm: a contact goes quiet after three
 * days, and acknowledging grants exactly one more quiet stretch.
 */
export const ACKNOWLEDGE_DAYS = FOLLOW_UP_QUIET_DAYS;

/** Event types that are bookkeeping, not contact, so they never reset the clock. */
const NON_ACTIVITY_EVENT_TYPES = new Set(["assigned", "acknowledged"]);

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
  next_follow_up_at: string | null;
  events: TEvent[];
  studies: TStudy[];
};

export type FollowUpStatus = {
  latestActivity: ActivitySnapshot;
  /** Days since real activity. Never affected by acknowledgement. */
  daysQuiet: number;
  isOverdue: boolean;
  acknowledged: boolean;
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
      .filter((event) => !NON_ACTIVITY_EVENT_TYPES.has(event.event_type))
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

/**
 * Has someone said "I've seen this" and promised to come back later?
 *
 * A follow-up date in the future is that promise. Once it passes, the promise is
 * broken rather than merely expired, which is why the board escalates instead of
 * returning to normal (see `missedFollowUp` in primitives/urgency-meter.tsx).
 */
export function isAcknowledged(
  person: Pick<FollowUpPersonLike, "next_follow_up_at">,
  now: number = Date.now()
): boolean {
  if (!person.next_follow_up_at) {
    return false;
  }

  const followUpAt = Date.parse(person.next_follow_up_at);

  return !Number.isNaN(followUpAt) && followUpAt > now;
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
  const acknowledged = isAcknowledged(person, now);

  return {
    latestActivity,
    // Reported as-is even when acknowledged: the count is a fact, not a nag.
    daysQuiet,
    isOverdue: daysQuiet >= FOLLOW_UP_QUIET_DAYS && !acknowledged,
    acknowledged,
  };
}

/** Convenience predicate for the cron: is this contact overdue for a follow-up? */
export function isFollowUpOverdue<
  TStudy extends FollowUpStudyLike,
  TEvent extends FollowUpEventLike,
>(person: FollowUpPersonLike<TStudy, TEvent>, now: number = Date.now()): boolean {
  return getFollowUpStatus(person, { now }).isOverdue;
}
