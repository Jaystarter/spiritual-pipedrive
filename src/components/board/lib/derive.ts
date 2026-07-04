import type {
  BoardPerson,
  BoardProfile,
  PersonEvent,
} from "@/app/actions";
import {
  FOLLOW_UP_QUIET_DAYS,
  getActivityCandidates,
  getLatestActivity,
} from "@/lib/follow-ups";
import type { Stage, StageId, StageToneName } from "@/lib/stages";

import type { AssignmentNotificationItem, FollowUpItem } from "../types";
import { addDays, daysSinceDate } from "./format";
import { getStudyTitle } from "./studies";

export const FOLLOW_UP_REMINDER_VISIBLE_MS = 15_000;
// A contact with no activity (creation, contact, logged event, or study) in this
// many days gets the urgent signal on its board card. This is intentionally
// separate from FOLLOW_UP_QUIET_DAYS, which powers the reminders.
export const STALE_CONTACT_GLOW_DAYS = 7;

// The archive flow stores the reason as a note bodied `${ARCHIVE_NOTE_PREFIX}${reason}`.
export const ARCHIVE_NOTE_PREFIX = "Archived — ";

export function getMissedFollowUpDate(
  nextFollowUpAt: string | null,
  quietDueAt: string
) {
  if (!nextFollowUpAt) {
    return quietDueAt;
  }

  const nextFollowUpTime = Date.parse(nextFollowUpAt);

  if (Number.isNaN(nextFollowUpTime) || nextFollowUpTime > Date.now()) {
    return quietDueAt;
  }

  return nextFollowUpAt;
}

export function getLatestActivitySnapshot(person: BoardPerson) {
  return getLatestActivity(person, (study) => `Study: ${getStudyTitle(study)}`);
}

/**
 * The ranking clock: a person's latest activity that has actually
 * happened. Future-dated entries (e.g. a study scheduled for next
 * week) don't count until their date arrives — only the ranking
 * ignores them; the quiet clock in lib/follow-ups keeps its own rules.
 */
function getLatestPastActivityTime(person: BoardPerson, now: number) {
  let latest = 0;

  for (const candidate of getActivityCandidates(person)) {
    const time = Date.parse(candidate.value);

    if (!Number.isNaN(time) && time <= now && time > latest) {
      latest = time;
    }
  }

  return latest;
}

/**
 * Living lanes: the most recently active contact floats to the top —
 * a study logged today, a fresh note or contact, a new arrival. Display
 * order only; sort_order (and the dnd/server math built on it) is the
 * tie-break, never the driver.
 */
export function sortPeopleByActivity(people: BoardPerson[]) {
  const now = Date.now();
  const activityByPerson = new Map(
    people.map((person) => [person.id, getLatestPastActivityTime(person, now)])
  );

  return [...people].sort((a, b) => {
    const activityDifference =
      (activityByPerson.get(b.id) ?? 0) - (activityByPerson.get(a.id) ?? 0);

    if (activityDifference !== 0) {
      return activityDifference;
    }

    return a.sort_order - b.sort_order;
  });
}

export function getTopActivePreviewPeople(people: BoardPerson[]) {
  return sortPeopleByActivity(people).slice(0, 7);
}

export function getAssignedProfiles(person: BoardPerson, profiles: BoardProfile[]) {
  return person.assigned_profile_ids
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter(Boolean) as BoardProfile[];
}

export function profileNames(person: BoardPerson, profiles: BoardProfile[]) {
  const assigned = getAssignedProfiles(person, profiles);

  if (assigned.length === 0) {
    return person.teacher || "No profiles assigned";
  }

  return assigned.map((profile) => profile.name).join(", ");
}

export function normalizeContactSearch(value: string) {
  return value.trim().toLowerCase();
}

export function matchesContactName(person: BoardPerson, query: string) {
  return person.name.toLowerCase().includes(query);
}

export function getActiveProfileFilterId(
  profileFilter: string,
  activeProfileId: string
) {
  return profileFilter === "mine"
    ? activeProfileId
    : profileFilter === "all"
      ? ""
      : profileFilter;
}

export function filterPeopleForProfile(
  people: BoardPerson[],
  profileFilter: string,
  activeProfileId: string
) {
  const activeFilterId = getActiveProfileFilterId(profileFilter, activeProfileId);

  return activeFilterId
    ? people.filter((person) => person.assigned_profile_ids.includes(activeFilterId))
    : people;
}

export function getStageLabel(stages: Stage[], stageId: StageId) {
  return stages.find((stage) => stage.id === stageId)?.label ?? "No stack";
}

export function displayStageCopy(value: string) {
  return value.replaceAll("Hunting", "Sowing Seeds");
}

export function getStageById(stages: Stage[], stageId: StageId) {
  return (
    stages.find((stage) => stage.id === stageId) ?? {
      id: stageId,
      label: stageId,
      shortLabel: stageId,
      description: "",
      tone: "sky" as StageToneName,
      sortOrder: 0,
      isHidden: false,
      isSystem: false,
    }
  );
}

export function getStageIndex(stages: Stage[], stageId: StageId) {
  const index = stages.findIndex((stage) => stage.id === stageId);

  return String(index === -1 ? stages.length + 1 : index + 1).padStart(2, "0");
}

const emptyMessages: Record<string, string> = {
  hunting: "Sow the first seed with prayer, care, or an invitation.",
  first_bible_study: "Schedule the first open-Bible conversation.",
  third_bible_study: "Move consistent early studies here.",
  seventh_bible_study: "Track steady studies that need continued care.",
  ready_for_baptism: "Keep final preparation visible and personal.",
  baptized: "Legacy baptisms will move into the Baptized lane.",
  brothers: "Baptized contacts continuing in care and service will gather here.",
  archive: "Archived contacts appear here. Use the Archive button on a contact to add one.",
};

export function getEmptyStageMessage(stage: Stage) {
  return emptyMessages[stage.id] ?? `No contacts in ${stage.label} yet.`;
}

export function getFollowUpItems(
  people: BoardPerson[],
  profiles: BoardProfile[],
  stages: Stage[]
): FollowUpItem[] {
  return people
    .filter((person) => person.stage !== "archive")
    .map((person) => {
      const latestActivity = getLatestActivitySnapshot(person);
      const daysQuiet = daysSinceDate(latestActivity.value);
      const assignedProfiles = getAssignedProfiles(person, profiles);
      const followUpDueAt = addDays(latestActivity.value, FOLLOW_UP_QUIET_DAYS);
      const ownerLabel =
        assignedProfiles.length > 0
          ? assignedProfiles.map((profile) => profile.name).join(", ")
          : person.teacher || "Unassigned";

      return {
        person,
        daysQuiet,
        latestActivity,
        ownerLabel,
        stageLabel: displayStageCopy(getStageById(stages, person.stage).label),
        followUpDueAt,
        missedAt: getMissedFollowUpDate(person.next_follow_up_at, followUpDueAt),
      };
    })
    .filter((item) => item.daysQuiet >= FOLLOW_UP_QUIET_DAYS)
    .sort((a, b) => b.daysQuiet - a.daysQuiet);
}

export function getAssignmentNotificationItems(
  people: BoardPerson[],
  profiles: BoardProfile[],
  activeProfile: BoardProfile | null
): AssignmentNotificationItem[] {
  if (!activeProfile) {
    return [];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return people
    .flatMap((person) =>
      person.events
        .filter(
          (event) =>
            event.event_type === "assigned" &&
            event.notification_profile_id === activeProfile.id
        )
        .map((event) => ({
          event,
          person,
          assignedProfile: profileById.get(event.notification_profile_id ?? "") ?? activeProfile,
          actorProfile: profileById.get(event.actor_profile_id ?? "") ?? null,
        }))
    )
    .sort((a, b) => {
      const aTime = Date.parse(a.event.created_at);
      const bTime = Date.parse(b.event.created_at);

      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
}

export function sortEventsByNewest(events: PersonEvent[]) {
  return [...events].sort((a, b) => {
    const aTime = Date.parse(a.created_at);
    const bTime = Date.parse(b.created_at);

    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export function getLatestContactReaction(events: PersonEvent[]) {
  return events.find(
    (event) =>
      event.event_type === "text_reaction" || event.event_type === "call_reaction"
  );
}

export function getArchiveReason(events: PersonEvent[]) {
  const note = sortEventsByNewest(events).find(
    (event) =>
      typeof event.body === "string" && event.body.startsWith(ARCHIVE_NOTE_PREFIX)
  );

  if (!note?.body) {
    return null;
  }

  const reason = note.body.slice(ARCHIVE_NOTE_PREFIX.length).trim();

  return reason.length > 0 ? reason : null;
}

export function getContactReactionDisplayTitle(event: PersonEvent) {
  return event.title.replace(/^(text|call):\s*/i, "");
}

export function isNoResponseReaction(
  event: PersonEvent | undefined
): event is PersonEvent {
  if (!event) {
    return false;
  }

  return (
    event.title.toLowerCase().includes("no reply") ||
    event.title.toLowerCase().includes("missed")
  );
}

export function isReactionOverdue(event: PersonEvent | undefined) {
  if (!isNoResponseReaction(event)) {
    return false;
  }

  const createdAt = new Date(event.created_at).getTime();

  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt >= 3 * 24 * 60 * 60 * 1000;
}
