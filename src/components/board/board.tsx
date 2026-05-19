"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ChangeEvent,
  type PointerEvent,
  type RefObject,
  type ReactNode,
  type WheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Moon,
  Phone,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";

import {
  addContactReaction,
  addPersonStudy,
  createPerson,
  createProfile,
  deletePerson,
  deletePersonStudy,
  deleteProfile,
  movePerson,
  saveStages,
  updatePersonAvatar,
  updatePersonStudyNote,
  updatePerson,
  type BoardProfile,
  type BoardPerson,
  type ContactReactionChannel,
  type ContactReactionOutcome,
  type PersonEvent,
  type PersonStudy,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ProfileSheet } from "@/components/profiles/profile-sheet";
import {
  getBoardView,
  getBoardViewServerSnapshot,
  onBoardViewChange,
  setBoardView,
  type BoardView,
} from "@/lib/board-view-client";
import {
  getActiveProfileId,
  getActiveProfileServerSnapshot,
  onActiveProfileChange,
  setActiveProfileId,
} from "@/lib/profiles-client";
import { useTheme } from "@/lib/theme-client";
import { cn } from "@/lib/utils";
import {
  createStageId,
  getAutomaticStudyStageId,
  getFallbackTone,
  getVisibleStages,
  isManualOnlyStage,
  normalizeStages,
  type Stage,
  type StageId,
  type StageToneName,
} from "@/lib/stages";

type BoardProps = {
  initialPeople: BoardPerson[];
  initialProfiles: BoardProfile[];
  initialStages: Stage[];
  configured: boolean;
  error?: string;
};

type MovePreview = {
  people: BoardPerson[];
  orderedIds: string[];
};

type StageTone = {
  text: string;
  soft: string;
  ring: string;
  dot: string;
  card: string;
  edge: string;
  glow: string;
};

type FollowUpItem = {
  person: BoardPerson;
  daysQuiet: number;
  latestActivity: {
    label: string;
    value: string;
  };
  ownerLabel: string;
  stageLabel: string;
  followUpDueAt: string;
  missedAt: string;
};

type AssignmentNotificationItem = {
  event: PersonEvent;
  person: BoardPerson;
  assignedProfile: BoardProfile;
  actorProfile: BoardProfile | null;
};

const stageTones: Record<StageToneName, StageTone> = {
  amber: {
    text: "text-sky-700",
    soft: "soft-control text-sky-700",
    ring: "ring-sky-300/60",
    dot: "bg-sky-400",
    card: "from-sky-100/55 via-white/30 to-transparent",
    edge: "via-sky-300/55",
    glow: "from-sky-100/60 via-white/0 to-transparent",
  },
  sky: {
    text: "text-blue-700",
    soft: "soft-control text-blue-700",
    ring: "ring-blue-300/60",
    dot: "bg-blue-400",
    card: "from-blue-100/50 via-white/30 to-transparent",
    edge: "via-blue-300/50",
    glow: "from-blue-100/55 via-white/0 to-transparent",
  },
  indigo: {
    text: "text-cyan-700",
    soft: "soft-control text-cyan-700",
    ring: "ring-cyan-300/60",
    dot: "bg-cyan-400",
    card: "from-cyan-100/50 via-white/30 to-transparent",
    edge: "via-cyan-300/50",
    glow: "from-cyan-100/55 via-white/0 to-transparent",
  },
  violet: {
    text: "text-sky-800",
    soft: "soft-control text-sky-800",
    ring: "ring-sky-300/60",
    dot: "bg-sky-500",
    card: "from-sky-100/45 via-white/30 to-transparent",
    edge: "via-sky-300/50",
    glow: "from-sky-100/55 via-white/0 to-transparent",
  },
  emerald: {
    text: "text-blue-800",
    soft: "soft-control text-blue-800",
    ring: "ring-blue-300/60",
    dot: "bg-blue-500",
    card: "from-blue-100/45 via-white/30 to-transparent",
    edge: "via-blue-300/50",
    glow: "from-blue-100/55 via-white/0 to-transparent",
  },
  green: {
    text: "text-cyan-800",
    soft: "soft-control text-cyan-800",
    ring: "ring-cyan-300/60",
    dot: "bg-cyan-500",
    card: "from-cyan-100/45 via-white/30 to-transparent",
    edge: "via-cyan-300/50",
    glow: "from-cyan-100/55 via-white/0 to-transparent",
  },
};

const emptyMessages: Record<string, string> = {
  hunting: "Sow the first seed with prayer, care, or an invitation.",
  first_bible_study: "Schedule the first open-Bible conversation.",
  third_bible_study: "Move consistent early studies here.",
  seventh_bible_study: "Track steady studies that need continued care.",
  ready_for_baptism: "Keep final preparation visible and personal.",
  baptized: "This month’s baptisms will glow here.",
};

const STUDY_TITLES = [
  "The Secret of the Forgiveness of Sins",
  "The Savior Of Each Age & The New Name",
  "Tree Of Life & Christ Ahnsahnghong",
  "Jerusalem Mother",
  "Heavenly Family & Earthly Family",
  "Keep The Sabbath Day Holy",
  "Passover The Way To Eternal Life",
  "Cross Reverence Is Idolatry",
  "Be Baptized Immediately",
  "The Bible Is Fact",
  "Whom Does The Bible Testify About?",
  "King David & Christ Ahnsahnghong",
  "God Who Built Zion",
  "Heavenly Wedding Banquet",
  "The History of Abraham's Family",
  "Prophecy of Daniel 2&7",
  "The Prophecy of Revelation 13",
  "The Prophecy of Revelation 17 & 18",
  "The Law of Tithe",
  "The City of Refuge & The Earth",
  "The Trinity",
  "The Order of Melchizedek",
  "Mother's the source of the water of life",
  "Weeds & Wheat",
  "The Church Bought With God's Own Blood",
  "What is the Gospel?",
  "You Shall Have No Other God's Before Me",
  "The Work of God Putting A Seal",
  "The Book of Life",
  "The Soul Exist",
  "The Church Established By The Root of David",
  "The Last Adam & Christ Ahnsahnghong",
  "The Bible is a book of Prophecy",
  "What Day of the Week is the biblical Sabbath",
  "The Law of Moses and The Law of Christ",
  "Moses & Jesus (Meaning of the Cross)",
  "Who are False Prophets",
  "Blessings Through Tithing",
  "About Food",
  "The Words of God are Absolute",
  "Apart From Me You Can Do Nothing",
  "The Commands Of God And The Rules of Men",
  "Watch Out For False Prophets",
  "The Reign of God and The Reign of the Devil",
  "The Law of Life and The Law of Death",
  "Jesus 2nd Coming & Last Judgement",
  "Coming on the Clouds",
  "The Lesson From the Fig Tree",
  "God's coming from the East",
  "Old Testament & New Testament Sabbath",
] as const;
const TOTAL_STUDIES = STUDY_TITLES.length;
const CM_TITLES = [
  "FI: Two Meanings of the Wife of Christ",
  "FI: The Bride in Rev 22:17 Indicates the Church",
  "FI: The Bride of the Lamb in Rev 19:7",
  'FI: The "Us" in Ge 1:26 Refers to the Triune God',
  "FI: God Cannot Be Two because the Bible Says God is One",
  "FI: God Cannot Come As A Man",
  "FI: Christ Should Perform Miraculous Signs",
  "FI: They Cannot Believe In God because They Cannot See Him",
  "FI: The Bible Is Just A Book Written By Men",
  "FI: We Can Be Saved Only By Faith",
  "FI: Deeds Have Nothing To Do With Salvation",
  "FI: Abolishment of the Passover of the New Covenant",
  "FI: Origin of Sunday Service",
  "FI: Sunday Service is Based on Jesus Resurrection and the Holy Spirit's",
  "FI: The Early Church Worshiped and Gave Offerings on Sunday",
  "FI: (Hosea 2:11) The Early Church Kept Sunday as the Lords Day",
  "FI: (Col 2:16) The Sabbath and the Feast Were Abolished",
  "FI: (Gal 4:10) The Sabbath and the Feast Were Abolished",
] as const;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const FOLLOW_UP_QUIET_DAYS = 3;
const FOLLOW_UP_REMINDER_VISIBLE_MS = 15_000;

function sortPeople(people: BoardPerson[]) {
  return [...people].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function daysInPipeline(createdAt: string) {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) {
    return 1;
  }

  const elapsedDays = Math.floor((Date.now() - timestamp) / 86_400_000);

  return Math.max(1, elapsedDays);
}

function daysSinceDate(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function addDays(value: string, days: number) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);

  return date.toISOString();
}

function getMissedFollowUpDate(nextFollowUpAt: string | null, quietDueAt: string) {
  if (!nextFollowUpAt) {
    return quietDueAt;
  }

  const nextFollowUpTime = Date.parse(nextFollowUpAt);

  if (Number.isNaN(nextFollowUpTime) || nextFollowUpTime > Date.now()) {
    return quietDueAt;
  }

  return nextFollowUpAt;
}

function getLatestActivitySnapshot(person: BoardPerson) {
  const candidates = [
    {
      label: "Created",
      value: person.created_at,
    },
    {
      label: "Contacted",
      value: person.last_contacted_at,
    },
    ...person.events
      .filter((event) => event.event_type !== "assigned")
      .map((event) => ({
        label: event.title || "Activity logged",
        value: event.created_at,
      })),
    ...person.studies.map((study) => ({
      label: `Study: ${getStudyTitle(study)}`,
      value: study.studied_at ?? study.created_at,
    })),
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return candidates.reduce((latest, item) => {
    const latestTime = Date.parse(latest.value);
    const itemTime = Date.parse(item.value);

    if (Number.isNaN(itemTime)) {
      return latest;
    }

    return Number.isNaN(latestTime) || itemTime > latestTime ? item : latest;
  }, candidates[0]);
}

function getTopActivePreviewPeople(people: BoardPerson[]) {
  return [...people]
    .sort((a, b) => {
      const activityDifference =
        Date.parse(getLatestActivitySnapshot(b).value) -
        Date.parse(getLatestActivitySnapshot(a).value);

      if (activityDifference !== 0 && !Number.isNaN(activityDifference)) {
        return activityDifference;
      }

      return a.sort_order - b.sort_order;
    })
    .slice(0, 7);
}

function getAssignedProfiles(person: BoardPerson, profiles: BoardProfile[]) {
  return person.assigned_profile_ids
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter(Boolean) as BoardProfile[];
}

function profileNames(person: BoardPerson, profiles: BoardProfile[]) {
  const assigned = getAssignedProfiles(person, profiles);

  if (assigned.length === 0) {
    return person.teacher || "No profiles assigned";
  }

  return assigned.map((profile) => profile.name).join(", ");
}

function normalizeContactSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesContactName(person: BoardPerson, query: string) {
  return person.name.toLowerCase().includes(query);
}

function getActiveProfileFilterId(profileFilter: string, activeProfileId: string) {
  return profileFilter === "mine"
    ? activeProfileId
    : profileFilter === "all"
      ? ""
      : profileFilter;
}

function filterPeopleForProfile(
  people: BoardPerson[],
  profileFilter: string,
  activeProfileId: string
) {
  const activeFilterId = getActiveProfileFilterId(profileFilter, activeProfileId);

  return activeFilterId
    ? people.filter((person) => person.assigned_profile_ids.includes(activeFilterId))
    : people;
}

function getStageLabel(stages: Stage[], stageId: StageId) {
  return stages.find((stage) => stage.id === stageId)?.label ?? "No stack";
}

function getFollowUpItems(
  people: BoardPerson[],
  profiles: BoardProfile[],
  stages: Stage[]
): FollowUpItem[] {
  return people
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

function getAssignmentNotificationItems(
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

function displayStageCopy(value: string) {
  return value.replaceAll("Hunting", "Sowing Seeds");
}

function sortEventsByNewest(events: PersonEvent[]) {
  return [...events].sort((a, b) => {
    const aTime = Date.parse(a.created_at);
    const bTime = Date.parse(b.created_at);

    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

function sortStudies(studies: PersonStudy[]) {
  return [...studies].sort((a, b) => a.study_number - b.study_number);
}

function getStudyCatalogTitle(studyNumber: number) {
  return STUDY_TITLES[studyNumber - 1] ?? `Study ${studyNumber}`;
}

function getStudyTitle(study: PersonStudy) {
  const title = study.title?.trim();

  if (!title || title === `Study ${study.study_number}`) {
    return getStudyCatalogTitle(study.study_number);
  }

  return title;
}

function getStudyTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLatestCompletedStudy(studies: PersonStudy[]) {
  return [...studies].sort((a, b) => {
    const studiedAtDifference =
      getStudyTimestamp(b.studied_at) - getStudyTimestamp(a.studied_at);

    if (studiedAtDifference !== 0) {
      return studiedAtDifference;
    }

    const createdAtDifference =
      getStudyTimestamp(b.created_at) - getStudyTimestamp(a.created_at);

    if (createdAtDifference !== 0) {
      return createdAtDifference;
    }

    return b.study_number - a.study_number;
  })[0];
}

function getLatestContactReaction(events: PersonEvent[]) {
  return events.find(
    (event) =>
      event.event_type === "text_reaction" || event.event_type === "call_reaction"
  );
}

function getContactReactionDisplayTitle(event: PersonEvent) {
  return event.title.replace(/^(text|call):\s*/i, "");
}

function isNoResponseReaction(event: PersonEvent | undefined): event is PersonEvent {
  if (!event) {
    return false;
  }

  return (
    event.title.toLowerCase().includes("no reply") ||
    event.title.toLowerCase().includes("missed")
  );
}

function isReactionOverdue(event: PersonEvent | undefined) {
  if (!isNoResponseReaction(event)) {
    return false;
  }

  const createdAt = new Date(event.created_at).getTime();

  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt >= 3 * 24 * 60 * 60 * 1000;
}

function getNextStudyNumber(studies: PersonStudy[]) {
  const completed = new Set(studies.map((study) => study.study_number));

  for (let studyNumber = 1; studyNumber <= TOTAL_STUDIES; studyNumber += 1) {
    if (!completed.has(studyNumber)) {
      return studyNumber;
    }
  }

  return TOTAL_STUDIES;
}

function getNextSortOrderForStage(
  people: BoardPerson[],
  personId: string,
  stage: StageId
) {
  return (
    Math.max(
      0,
      ...people
        .filter((person) => person.id !== personId && person.stage === stage)
        .map((person) => person.sort_order)
    ) + 1000
  );
}

function getClientAutomaticStudyStage(
  person: BoardPerson,
  studyCount: number,
  visibleStageIds: Set<StageId>
) {
  if (isManualOnlyStage(person.stage)) {
    return person.stage;
  }

  const targetStage = getAutomaticStudyStageId(studyCount);

  return visibleStageIds.has(targetStage) ? targetStage : person.stage;
}

function getDateValue(value: string | null | undefined) {
  const datePart = value?.slice(0, 10);

  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  return new Date().toISOString().slice(0, 10);
}

function dateValueToUtcDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateToDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDateValue(dateValue: string, offsetDays: number) {
  const date = dateValueToUtcDate(dateValue);
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return utcDateToDateValue(date);
}

function getWeekStartDateValue(dateValue: string) {
  const date = dateValueToUtcDate(dateValue);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());

  return utcDateToDateValue(date);
}

function getDateRangeValues(startDateValue: string, dayCount: number) {
  const startDate = dateValueToUtcDate(startDateValue);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);

    return utcDateToDateValue(date);
  });
}

function formatCalendarTitle(dateValue: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateValueToUtcDate(dateValue));
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function buildMovePreview(
  people: BoardPerson[],
  id: string,
  targetStage: StageId,
  targetIndex: number
): MovePreview | null {
  const person = people.find((item) => item.id === id);

  if (!person) {
    return null;
  }

  const targetPeople = sortPeople(
    people.filter((item) => item.stage === targetStage && item.id !== id)
  );
  const nextTargetPeople = [...targetPeople];
  const boundedIndex = Math.max(0, Math.min(targetIndex, nextTargetPeople.length));
  const baptizedAt =
    targetStage === "baptized" ? person.baptized_at ?? new Date().toISOString() : null;

  nextTargetPeople.splice(boundedIndex, 0, {
    ...person,
    stage: targetStage,
    baptized_at: baptizedAt,
  });

  const orderedIds = nextTargetPeople.map((item) => item.id);
  const orderMap = new Map(orderedIds.map((personId, index) => [personId, index]));

  return {
    orderedIds,
    people: people.map((item) => {
      const order = orderMap.get(item.id);

      if (order === undefined) {
        return item.id === id ? { ...item, stage: targetStage, baptized_at: baptizedAt } : item;
      }

      return {
        ...item,
        stage: targetStage,
        baptized_at: item.id === id ? baptizedAt : item.baptized_at,
        sort_order: (order + 1) * 1000,
      };
    }),
  };
}

function getStageById(stages: Stage[], stageId: StageId) {
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

function getStageTone(stages: Stage[], stageId: StageId) {
  const stage = getStageById(stages, stageId);

  return stageTones[stage.tone] ?? stageTones.sky;
}

function getStageIndex(stages: Stage[], stageId: StageId) {
  const index = stages.findIndex((stage) => stage.id === stageId);

  return String(index === -1 ? stages.length + 1 : index + 1).padStart(2, "0");
}

function getEmptyStageMessage(stage: Stage) {
  return emptyMessages[stage.id] ?? `No contacts in ${stage.label} yet.`;
}

function getNextStage(stages: Stage[], stage: StageId, direction: -1 | 1) {
  const index = stages.findIndex((item) => item.id === stage);
  const next = stages[index + direction];

  return next?.id;
}

type StackExpandedState = Partial<Record<StageId, boolean>>;
const MOBILE_STACK_MEDIA_QUERY = "(max-width: 39.999rem)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    return typeof window !== "undefined" ? window.matchMedia(query).matches : false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

export function BibleStudyBoard({
  initialPeople,
  initialProfiles,
  initialStages,
  configured,
  error,
}: BoardProps) {
  const [mounted, setMounted] = useState(false);
  const [people, setPeople] = useState(initialPeople);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [stages, setStages] = useState(() => normalizeStages(initialStages));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState(error);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [followUpReminderVisible, setFollowUpReminderVisible] = useState(false);
  const followUpReminderRef = useRef<HTMLDivElement>(null);
  const followUpReminderTimeoutRef = useRef<number | null>(null);
  const activeProfileId = useSyncExternalStore(
    onActiveProfileChange,
    getActiveProfileId,
    getActiveProfileServerSnapshot
  );
  const boardView = useSyncExternalStore(
    onBoardViewChange,
    getBoardView,
    getBoardViewServerSnapshot
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    return () => {
      if (followUpReminderTimeoutRef.current !== null) {
        window.clearTimeout(followUpReminderTimeoutRef.current);
        followUpReminderTimeoutRef.current = null;
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredPeople = useMemo(() => {
    const query = normalizeContactSearch(search);
    const profileFilteredPeople = filterPeopleForProfile(
      people,
      profileFilter,
      activeProfileId
    );

    if (!query) {
      return profileFilteredPeople;
    }

    return profileFilteredPeople.filter((person) => matchesContactName(person, query));
  }, [activeProfileId, people, profileFilter, search]);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const visibleStages = useMemo(() => getVisibleStages(stages), [stages]);
  const visibleStageIds = useMemo(
    () => new Set(visibleStages.map((stage) => stage.id)),
    [visibleStages]
  );
  const requireProfile = configured && !activeProfile;
  const activePerson = activeId
    ? people.find((person) => person.id === activeId) ?? null
    : null;
  const selectedPerson = selectedId
    ? people.find((person) => person.id === selectedId) ?? null
    : null;
  const followUpItems = useMemo(
    () => getFollowUpItems(filteredPeople, profiles, visibleStages),
    [filteredPeople, profiles, visibleStages]
  );
  const assignmentNotificationItems = useMemo(
    () => getAssignmentNotificationItems(people, profiles, activeProfile),
    [activeProfile, people, profiles]
  );

  function requireActiveProfile() {
    if (!activeProfile) {
      setProfileSheetOpen(true);
      setNotice("Choose your profile before making changes.");
      return null;
    }

    return activeProfile.id;
  }

  function handleSelectProfile(profileId: string) {
    setActiveProfileId(profileId);
    setProfileSheetOpen(false);
    setNotice(undefined);
  }

  function persistMove(personId: string, stage: StageId, orderedIds: string[]) {
    const actorProfileId = requireActiveProfile();

    if (!actorProfileId) {
      return;
    }

    startTransition(async () => {
      const result = await movePerson({ id: personId, stage, orderedIds, actorProfileId });

      if (!result.ok) {
        setNotice(result.error);
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    if (!event.over) {
      return;
    }

    const personId = String(event.active.id);
    const overId = String(event.over.id);
    const overPerson = people.find((person) => person.id === overId);
    const targetStage = visibleStageIds.has(overId) ? overId : overPerson?.stage;

    if (!targetStage) {
      return;
    }

    const targetPeople = sortPeople(
      people.filter((person) => person.stage === targetStage && person.id !== personId)
    );
    const targetIndex = overPerson
      ? targetPeople.findIndex((person) => person.id === overPerson.id)
      : targetPeople.length;
    const preview = buildMovePreview(
      people,
      personId,
      targetStage,
      targetIndex === -1 ? targetPeople.length : targetIndex
    );

    if (!preview) {
      return;
    }

    setNotice(undefined);
    setPeople(preview.people);
    persistMove(personId, targetStage, preview.orderedIds);
  }

  function moveWithButtons(person: BoardPerson, stage: StageId) {
    const targetIndex = people.filter((item) => item.stage === stage).length;
    const preview = buildMovePreview(people, person.id, stage, targetIndex);

    if (!preview) {
      return;
    }

    setNotice(undefined);
    setPeople(preview.people);
    persistMove(person.id, stage, preview.orderedIds);
  }

  function handleCreated(person: BoardPerson) {
    setPeople((current) => sortPeople([...current, person]));
    setSelectedId(person.id);
  }

  function handleUpdated(person: BoardPerson) {
    setPeople((current) =>
      current.map((item) =>
        item.id === person.id
          ? {
              ...person,
              events:
                person.events.length > 0
                  ? sortEventsByNewest([
                      ...person.events,
                      ...item.events.filter(
                        (event) =>
                          !person.events.some((incomingEvent) => incomingEvent.id === event.id)
                      ),
                    ])
                  : item.events,
              studies: item.studies,
            }
          : item
      )
    );
  }

  function handleDeleted(personId: string) {
    const deletedPerson = people.find((person) => person.id === personId);

    setPeople((current) => current.filter((person) => person.id !== personId));
    setSelectedId((current) => (current === personId ? null : current));

    if (deletedPerson) {
      setProfiles((current) =>
        current.map((profile) =>
          deletedPerson.assigned_profile_ids.includes(profile.id)
            ? {
                ...profile,
                active_contacts: Math.max(0, profile.active_contacts - 1),
              }
            : profile
        )
      );
    }
  }

  function handleStudyLogged(
    personId: string,
    study: PersonStudy,
    event: PersonEvent
  ) {
    setPeople((current) => {
      return current.map((person) => {
        if (person.id !== personId) {
          return person;
        }

        const nextStudies = sortStudies([
          ...person.studies.filter(
            (item) => item.study_number !== study.study_number
          ),
          study,
        ]);
        const nextStage = getClientAutomaticStudyStage(
          person,
          nextStudies.length,
          visibleStageIds
        );
        const stageChanged = nextStage !== person.stage;

        return {
          ...person,
          stage: nextStage,
          sort_order: stageChanged
            ? getNextSortOrderForStage(current, person.id, nextStage)
            : person.sort_order,
          baptized_at: stageChanged ? null : person.baptized_at,
          studies: nextStudies,
          events: [event, ...person.events],
        };
      });
    });
  }

  function handleStudyRenamed(personId: string, study: PersonStudy) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              studies: sortStudies(
                person.studies.map((item) => (item.id === study.id ? study : item))
              ),
            }
          : person
      )
    );
  }

  function handleStudyDeleted(personId: string, studyId: string) {
    setPeople((current) => {
      return current.map((person) => {
        if (person.id !== personId) {
          return person;
        }

        const nextStudies = person.studies.filter((study) => study.id !== studyId);
        const nextStage = getClientAutomaticStudyStage(
          person,
          nextStudies.length,
          visibleStageIds
        );
        const stageChanged = nextStage !== person.stage;

        return {
          ...person,
          stage: nextStage,
          sort_order: stageChanged
            ? getNextSortOrderForStage(current, person.id, nextStage)
            : person.sort_order,
          baptized_at: stageChanged ? null : person.baptized_at,
          studies: nextStudies,
        };
      });
    });
  }

  function handleReactionLogged(personId: string, event: PersonEvent) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              last_contacted_at: event.created_at,
              events: [event, ...person.events],
            }
          : person
      )
    );
  }

  function handleFocusFollowUps() {
    if (followUpReminderTimeoutRef.current !== null) {
      window.clearTimeout(followUpReminderTimeoutRef.current);
      followUpReminderTimeoutRef.current = null;
    }

    setFollowUpReminderVisible(true);
    const timeout = window.setTimeout(() => {
      if (followUpReminderTimeoutRef.current !== timeout) {
        return;
      }

      setFollowUpReminderVisible(false);
      followUpReminderTimeoutRef.current = null;
    }, FOLLOW_UP_REMINDER_VISIBLE_MS);
    followUpReminderTimeoutRef.current = timeout;

    window.requestAnimationFrame(() => {
      followUpReminderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      followUpReminderRef.current?.focus({ preventScroll: true });
    });
  }

  if (!mounted) {
    return (
      <main className="relative min-h-screen overflow-hidden text-foreground" style={{ background: "var(--neu-bg)" }}>
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 pipeline-flat-bg" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground" style={{ background: "var(--neu-bg)" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 pipeline-flat-bg" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1840px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-6 sm:pt-7">
        <AppShellHeader
          search={search}
          onSearch={setSearch}
          profiles={profiles}
          activeProfile={activeProfile}
          profileFilter={profileFilter}
          onProfileFilterChange={setProfileFilter}
          onOpenProfiles={() => setProfileSheetOpen(true)}
          onSelectProfile={handleSelectProfile}
          onSelectContact={setSelectedId}
          onAddContact={() => setQuickAddOpen(true)}
          allPeople={people}
          graphPeople={filteredPeople}
          graphProfiles={profiles}
          stages={visibleStages}
          allStages={stages}
          onStagesChange={setStages}
          configured={configured}
          notice={notice}
          followUpItems={followUpItems}
          assignmentNotificationItems={assignmentNotificationItems}
          onFocusFollowUps={handleFocusFollowUps}
          boardView={boardView}
          onBoardViewChange={setBoardView}
        />

        <FollowUpReminderList
          isVisible={followUpReminderVisible}
          items={followUpItems}
          assignmentItems={assignmentNotificationItems}
          reminderRef={followUpReminderRef}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {boardView === "pipeline" ? (
            <JourneyBoard
              people={filteredPeople}
              stages={visibleStages}
              profiles={profiles}
              activeProfile={activeProfile}
              configured={configured}
              isPending={isPending}
              onMove={moveWithButtons}
              onNotice={setNotice}
              onSelect={setSelectedId}
              onReactionLogged={handleReactionLogged}
            />
          ) : (
            <StackBoard
              people={filteredPeople}
              stages={visibleStages}
              profiles={profiles}
              activeProfile={activeProfile}
              configured={configured}
              isPending={isPending}
              searchActive={search.trim().length > 0}
              onMove={moveWithButtons}
              onNotice={setNotice}
              onSelect={setSelectedId}
              onReactionLogged={handleReactionLogged}
            />
          )}

          <DragOverlay>
            {boardView === "pipeline" && activePerson ? (
              <CardPreview person={activePerson} profiles={profiles} stages={visibleStages} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <PersonDetailPanel
        key={selectedPerson?.id ?? "empty"}
        person={selectedPerson}
        profiles={profiles}
        activeProfile={activeProfile}
        stages={visibleStages}
        configured={configured}
        onClose={() => setSelectedId(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onProfilesChange={setProfiles}
        onNotice={setNotice}
        onStudyLogged={handleStudyLogged}
        onStudyRenamed={handleStudyRenamed}
        onStudyDeleted={handleStudyDeleted}
      />
      <QuickAddContactDialog
        open={quickAddOpen}
        profiles={profiles}
        activeProfile={activeProfile}
        stages={visibleStages}
        configured={configured}
        onClose={() => setQuickAddOpen(false)}
        onCreated={handleCreated}
        onProfilesChange={setProfiles}
        onNotice={setNotice}
      />
      <ProfileSheet
        open={profileSheetOpen || requireProfile}
        required={requireProfile}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onClose={() => setProfileSheetOpen(false)}
        onProfilesChange={setProfiles}
        onSelectProfile={handleSelectProfile}
      />
    </main>
  );
}

function AppShellHeader({
  search,
  onSearch,
  profiles,
  activeProfile,
  profileFilter,
  onProfileFilterChange,
  onOpenProfiles,
  onSelectProfile,
  onSelectContact,
  onAddContact,
  allPeople,
  graphPeople,
  graphProfiles,
  stages,
  allStages,
  onStagesChange,
  configured,
  notice,
  followUpItems,
  assignmentNotificationItems,
  onFocusFollowUps,
  boardView,
  onBoardViewChange,
}: {
  search: string;
  onSearch: (value: string) => void;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  profileFilter: string;
  onProfileFilterChange: (value: string) => void;
  onOpenProfiles: () => void;
  onSelectProfile: (profileId: string) => void;
  onSelectContact: (personId: string) => void;
  onAddContact: () => void;
  allPeople: BoardPerson[];
  graphPeople: BoardPerson[];
  graphProfiles: BoardProfile[];
  stages: Stage[];
  allStages: Stage[];
  onStagesChange: (stages: Stage[]) => void;
  configured: boolean;
  notice?: string;
  followUpItems: FollowUpItem[];
  assignmentNotificationItems: AssignmentNotificationItem[];
  onFocusFollowUps: () => void;
  boardView: BoardView;
  onBoardViewChange: (view: BoardView) => void;
}) {
  const [openControl, setOpenControl] = useState<"search" | null>(null);
  const [searchPanelMode, setSearchPanelMode] = useState<"name" | "profile">("name");
  const [railExpanded, setRailExpanded] = useState(false);
  const [settingsMode, setSettingsMode] = useState<"closed" | "menu" | "graphs" | "edit">("closed");
  const [theme, setTheme] = useTheme();
  const nameSearchPanelId = useId();
  const profileFilterPanelId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastProfileWheelAtRef = useRef(0);
  const lastRailToggleAtRef = useRef(0);
  const activeProfileIndex = activeProfile
    ? profiles.findIndex((profile) => profile.id === activeProfile.id)
    : -1;
  const normalizedContactSearch = normalizeContactSearch(search);
  const profileScopedPeople = useMemo(
    () => filterPeopleForProfile(allPeople, profileFilter, activeProfile?.id ?? ""),
    [activeProfile?.id, allPeople, profileFilter]
  );
  const contactSearchMatches = useMemo(() => {
    if (!normalizedContactSearch) {
      return [];
    }

    return sortPeople(
      profileScopedPeople.filter((person) =>
        matchesContactName(person, normalizedContactSearch)
      )
    );
  }, [normalizedContactSearch, profileScopedPeople]);
  const contactSearchPreview = contactSearchMatches.slice(0, 6);
  const activeFilterLabel =
    profileFilter === "mine"
      ? "My contacts"
      : profileFilter === "all"
        ? "All contacts"
        : profiles.find((profile) => profile.id === profileFilter)?.name ?? "All contacts";
  const notificationCount = followUpItems.length + assignmentNotificationItems.length;
  const profileIndicatorProfiles =
    profiles.length <= 3 || activeProfileIndex < 0
      ? profiles
      : [-1, 0, 1].map(
          (offset) =>
            profiles[(activeProfileIndex + offset + profiles.length) % profiles.length]
        );

  function selectRelativeProfile(direction: 1 | -1) {
    if (profiles.length < 2) {
      return;
    }

    const currentIndex = activeProfileIndex >= 0 ? activeProfileIndex : 0;
    const nextProfile =
      profiles[(currentIndex + direction + profiles.length) % profiles.length];

    if (!nextProfile || nextProfile.id === activeProfile?.id) {
      return;
    }

    onSelectProfile(nextProfile.id);
  }

  function handleProfileWheel(event: WheelEvent<HTMLDivElement>) {
    if (profiles.length < 2) {
      return;
    }

    const horizontalDelta = event.deltaX || (event.shiftKey ? event.deltaY : 0);

    if (Math.abs(horizontalDelta) < 28) {
      return;
    }

    event.preventDefault();

    const now = Date.now();
    if (now - lastProfileWheelAtRef.current < 360) {
      return;
    }

    lastProfileWheelAtRef.current = now;
    selectRelativeProfile(horizontalDelta > 0 ? 1 : -1);
  }

  function handleProfilePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (profiles.length < 2) {
      return;
    }

    profileSwipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleProfilePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = profileSwipeStartRef.current;
    profileSwipeStartRef.current = null;

    if (!start || profiles.length < 2) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) {
      return;
    }

    selectRelativeProfile(deltaX < 0 ? 1 : -1);
  }

  function handleRailToggle() {
    const now = Date.now();

    if (now - lastRailToggleAtRef.current < 180) {
      return;
    }

    lastRailToggleAtRef.current = now;
    setRailExpanded((expanded) => {
      if (expanded || openControl !== null) {
        setOpenControl(null);
        return false;
      }

      return true;
    });
  }

  useEffect(() => {
    if (openControl !== "search" || searchPanelMode !== "name") {
      return;
    }

    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [openControl, searchPanelMode]);

  const floatingActionButtonClass =
    "neu-raised-sm relative inline-flex size-10 items-center justify-center rounded-full text-[var(--neu-text)] transition duration-200 ease-out hover:-translate-y-0.5 hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0";
  const floatingActionButtonActiveClass =
    "neu-pressed text-[var(--neu-accent)]";
  const railOpen = railExpanded || openControl !== null;

  return (
    <header className="relative isolate z-[70] overflow-visible">
      <div
        className="profile-hero-bg neu-raised relative mx-0 -mt-2 min-h-[15rem] overflow-hidden text-[var(--neu-text-strong)] sm:mx-0 sm:-mt-3 sm:min-h-[16rem]"
        style={{ borderRadius: "1.5rem" }}
        onPointerCancel={() => {
          profileSwipeStartRef.current = null;
        }}
        onPointerDown={handleProfilePointerDown}
        onPointerUp={handleProfilePointerUp}
        onWheel={handleProfileWheel}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "var(--neu-bg)" }}
        >
          {activeProfile?.avatar_url ? (
            <span
              className="neu-inset relative size-[8.5rem] overflow-hidden sm:size-[11rem]"
              style={{ borderRadius: "9999px" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                draggable={false}
                src={activeProfile.avatar_url}
                className="size-full"
                style={{
                  objectFit: "cover",
                  objectPosition: `${activeProfile.avatar_offset_x ?? 50}% ${activeProfile.avatar_offset_y ?? 50}%`,
                  transform: `scale(${activeProfile.avatar_scale ?? 1})`,
                  transformOrigin: "center",
                }}
              />
            </span>
          ) : (
            <span
              className="font-display text-[7rem] leading-none tracking-display sm:text-[10rem]"
              style={{ color: "rgba(163, 177, 198, 0.32)" }}
            >
              {activeProfile?.name.slice(0, 1).toUpperCase() ?? "S"}
            </span>
          )}
        </div>
        <h1 className="header-hero-wordmark pointer-events-none absolute left-5 top-4 z-10 select-none font-display text-[1rem] italic leading-none tracking-[0.16em] sm:left-7 sm:top-5 sm:text-[1.15rem]">
          S-Drive
        </h1>
        <button
          type="button"
          aria-label="Open settings"
          aria-expanded={settingsMode !== "closed"}
          onClick={() =>
            setSettingsMode((mode) => (mode === "menu" ? "closed" : "menu"))
          }
          className={cn(
            "neu-raised-sm absolute right-3 top-3 z-20 inline-flex size-10 items-center justify-center rounded-full text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 sm:right-4 sm:top-4",
            settingsMode !== "closed" && "neu-pressed text-[var(--neu-accent)]"
          )}
        >
          <Settings className="size-4" />
        </button>
        <AnimatePresence initial={false}>
          {settingsMode === "menu" ? (
            <motion.div
              className="fixed right-[3.75rem] top-3 z-[220] flex flex-row-reverse items-center gap-2.5 sm:right-[4.5rem] sm:top-4"
              initial={{ opacity: 0, x: 8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <button
                type="button"
                aria-label="Open graphs"
                className={cn(floatingActionButtonClass, "size-10")}
                onClick={() => setSettingsMode("graphs")}
                title="Graphs"
              >
                <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
                  <span className="h-2 w-1 rounded-full bg-current opacity-55" />
                  <span className="h-3.5 w-1 rounded-full bg-current" />
                  <span className="h-2.5 w-1 rounded-full bg-current opacity-75" />
                </span>
              </button>
              <button
                type="button"
                aria-label={boardView === "stack" ? "Switch to pipeline view" : "Switch to stack view"}
                aria-pressed={boardView === "stack"}
                className={cn(
                  floatingActionButtonClass,
                  "size-10",
                  boardView === "stack" && floatingActionButtonActiveClass
                )}
                onClick={() => {
                  onBoardViewChange(boardView === "stack" ? "pipeline" : "stack");
                  setSettingsMode("closed");
                }}
                title={boardView === "stack" ? "Switch to pipeline view" : "Stack View"}
              >
                <span aria-hidden="true" className="relative block size-5">
                  <span className="absolute left-1 top-0.5 h-3.5 w-3.5 rounded-md border border-current/55 bg-white/50" />
                  <span className="absolute left-0.5 top-1.5 h-3.5 w-3.5 rounded-md border border-current/70 bg-white/65" />
                  <span className="absolute left-0 top-2.5 h-3.5 w-3.5 rounded-md border border-current bg-white/80" />
                </span>
                {boardView === "stack" ? (
                  <span
                    className="neu-accent-fill absolute -right-0.5 -top-0.5 inline-flex size-5 items-center justify-center rounded-full text-white"
                  >
                    <Check className="size-3" />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label="Edit stack"
                className={cn(floatingActionButtonClass, "size-10")}
                onClick={() => setSettingsMode("edit")}
                title="Edit Stack"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-pressed={theme === "dark"}
                className={cn(
                  floatingActionButtonClass,
                  "size-10",
                  theme === "dark" && floatingActionButtonActiveClass
                )}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {profiles.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous profile"
              className="neu-raised-sm absolute left-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 sm:inline-flex"
              onClick={() => selectRelativeProfile(-1)}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next profile"
              className="neu-raised-sm absolute right-5 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 sm:right-8 sm:inline-flex"
              onClick={() => selectRelativeProfile(1)}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
        {profiles.length > 1 ? (
          <div
            aria-label="Profile carousel"
            className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-8"
            role="tablist"
          >
            {profileIndicatorProfiles.map((profile) => {
              const isActive = profile.id === activeProfile?.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-label={`Switch to ${profile.name}`}
                  aria-selected={isActive}
                  className={cn(
                    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40",
                    isActive ? "neu-accent-fill h-2 w-6 rounded-full" : "neu-inset size-2 rounded-full"
                  )}
                  onClick={() => onSelectProfile(profile.id)}
                  role="tab"
                />
              );
            })}
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 sm:px-8 sm:pb-7">
          <div className="max-w-[min(28rem,calc(100vw-2.5rem))]">
            <button
              type="button"
              aria-label="Open profiles"
              onClick={onOpenProfiles}
              className="font-display text-3xl italic leading-none tracking-display text-[var(--neu-text-strong)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 sm:text-4xl"
            >
              {activeProfile?.name ?? "Choose profile"}
            </button>
          </div>
          <div className="absolute bottom-5 right-5 flex flex-col items-end text-right text-xs font-semibold leading-tight text-[var(--neu-text)] sm:bottom-7 sm:right-8">
            {activeProfile ? (
              <>
                <span>{activeProfile.active_contacts} contacts</span>
                <span>{activeProfile.baptized_this_month} baptized</span>
              </>
            ) : (
              <span>No profile selected</span>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="header-hero-beam" />
      </div>

          <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(0.75rem+env(safe-area-inset-right))] z-[80] flex flex-col items-end gap-2 overflow-visible sm:bottom-8 sm:right-6">
            <AnimatePresence initial={false}>
              {railOpen ? (
                <motion.div
                  className="flex flex-col items-end gap-2"
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <button
                    type="button"
                    aria-label="Add contact"
                    disabled={!configured || !activeProfile}
                    onClick={() => {
                      setOpenControl(null);
                      setRailExpanded(false);
                      onAddContact();
                    }}
                    className={floatingActionButtonClass}
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Open search and filters"
                    aria-expanded={openControl === "search"}
                    aria-pressed={openControl === "search"}
                    onClick={() => {
                      setRailExpanded(true);
                      setOpenControl((current) => {
                        const nextOpen = current === "search" ? null : "search";

                        if (nextOpen === "search") {
                          setSearchPanelMode("name");
                        }

                        return nextOpen;
                      });
                    }}
                    className={cn(
                      floatingActionButtonClass,
                      (openControl === "search" || search || profileFilter !== "all") &&
                        floatingActionButtonActiveClass
                    )}
                  >
                    <Search className="size-4" />
                    {search || profileFilter !== "all" ? (
                      <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full" style={{ background: "var(--neu-accent)" }} />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label={
                      notificationCount > 0
                        ? `Show ${notificationCount} notifications`
                        : "No notifications"
                    }
                    onClick={() => {
                      setOpenControl(null);
                      setRailExpanded(false);
                      onFocusFollowUps();
                    }}
                    className={cn(
                      floatingActionButtonClass,
                      notificationCount > 0 && "text-sky-600"
                    )}
                  >
                    <NikeSwoosh className="size-4" />
                    {notificationCount > 0 ? (
                      <span
                        className="neu-accent-fill absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.58rem] font-black leading-5 text-white"
                      >
                        {Math.min(notificationCount, 9)}
                      </span>
                    ) : null}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <button
              type="button"
              aria-label={railOpen ? "Collapse quick actions" : "Expand quick actions"}
              aria-expanded={railOpen}
              onClick={handleRailToggle}
              className={cn(
                "neu-raised relative inline-flex items-center justify-center rounded-full text-[var(--neu-accent)] transition duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)] active:translate-y-0 active:scale-95",
                railOpen ? "size-10" : "size-12",
                railOpen && "neu-pressed"
              )}
            >
              <Plus
                className={cn(
                  "transition-transform duration-200",
                  railOpen ? "size-4 rotate-45" : "size-5"
                )}
              />
              {notificationCount > 0 && !railOpen ? (
                <span
                  className="neu-accent-fill absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.58rem] font-black leading-5 text-white"
                >
                  {Math.min(notificationCount, 9)}
                </span>
              ) : null}
              {(search || profileFilter !== "all") && notificationCount === 0 && !railOpen ? (
                <span className="absolute right-2 top-2 size-2 rounded-full" style={{ background: "var(--neu-accent)" }} />
              ) : null}
            </button>

            {openControl === "search" ? (
              <div className="soft-panel-strong fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] right-[calc(0.75rem+env(safe-area-inset-right))] z-[100] max-h-[min(68vh,30rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border p-3 sm:bottom-24 sm:right-6">
                <div className="relative mb-3 flex h-6 items-center justify-center">
                  <span className="text-center text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Search & filter
                  </span>
                  <button
                    type="button"
                    aria-label="Close search and filters"
                    onClick={() => setOpenControl(null)}
                    className="absolute right-0 rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div
                  aria-label="Search and filter tools"
                  className={cn(
                    "grid gap-4 border-b border-sky-100/80 px-1",
                    searchPanelMode === "name"
                      ? "grid-cols-[minmax(0,1.35fr)_minmax(6.75rem,0.8fr)]"
                      : "grid-cols-[minmax(6.75rem,0.8fr)_minmax(0,1.35fr)]"
                  )}
                  role="tablist"
                >
                  {searchPanelMode === "name" ? (
                    <div
                      aria-controls={nameSearchPanelId}
                      aria-label="Search by contact name"
                      aria-selected="true"
                      className="flex h-11 min-w-0 items-center gap-2 border-b-2 border-sky-400 px-1 pb-2 pt-1 text-sky-700 transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-ring/20"
                      role="tab"
                    >
                      <Search className="size-4 shrink-0" />
                      <span className="sr-only">Search contacts by name</span>
                      <input
                        ref={searchInputRef}
                        aria-label="Search contacts by name"
                        className="min-w-0 flex-1 bg-transparent text-sm font-bold tracking-tight text-foreground outline-none placeholder:text-sky-700/55"
                        placeholder="Name"
                        value={search}
                        onChange={(event) => onSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setOpenControl(null);
                          }
                        }}
                      />
                      {search ? (
                        <button
                          type="button"
                          aria-label="Clear search"
                          onClick={() => onSearch("")}
                          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-controls={nameSearchPanelId}
                      aria-label="Search by contact name"
                      aria-selected="false"
                      onClick={() => setSearchPanelMode("name")}
                      role="tab"
                      className="inline-flex h-11 items-center justify-center gap-2 border-b-2 border-transparent px-1 pb-2 pt-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground transition hover:border-sky-200 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      <Search className="size-4" />
                      <span>Name</span>
                    </button>
                  )}
                  {searchPanelMode === "profile" ? (
                    <div
                      aria-controls={profileFilterPanelId}
                      aria-label="Filter by profile"
                      aria-selected="true"
                      className="relative flex h-11 min-w-0 items-center gap-2 border-b-2 border-sky-400 px-1 pb-2 pt-1 text-sky-700 transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-ring/20"
                      role="tab"
                    >
                      <span aria-hidden="true" className="relative block size-4 shrink-0">
                        <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-current" />
                        <span className="absolute bottom-0 left-0 size-2 rounded-full bg-current opacity-60" />
                        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-current opacity-80" />
                      </span>
                      <select
                        value={profileFilter}
                        onChange={(event) => onProfileFilterChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setOpenControl(null);
                          }
                        }}
                        className="min-w-0 flex-1 appearance-none bg-transparent pr-5 text-sm font-bold tracking-tight text-foreground outline-none"
                        aria-label="Filter by profile"
                      >
                        <option value="all">All profiles</option>
                        <option value="mine">My contacts</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-3 size-3.5 rotate-90 text-muted-foreground" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-controls={profileFilterPanelId}
                      aria-label="Filter by profile"
                      aria-selected="false"
                      onClick={() => setSearchPanelMode("profile")}
                      role="tab"
                      className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-b-2 border-transparent px-1 pb-2 pt-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground transition hover:border-sky-200 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      <span aria-hidden="true" className="relative block size-4 shrink-0">
                        <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-current" />
                        <span className="absolute bottom-0 left-0 size-2 rounded-full bg-current opacity-60" />
                        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-current opacity-80" />
                      </span>
                      <span className="truncate">
                        {profileFilter === "all" ? "Profile" : activeFilterLabel}
                      </span>
                    </button>
                  )}
                </div>

                <div
                  id={nameSearchPanelId}
                  className={normalizedContactSearch ? "mt-3" : "sr-only"}
                  role="tabpanel"
                >
                  {normalizedContactSearch ? (
                    <div className="rounded-2xl border border-white/70 bg-white/45 p-2 shadow-[0_1px_0_oklch(1_0_0_/_0.9)_inset]">
                      <div className="flex items-center justify-between gap-3 px-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        <span>
                          {`${contactSearchMatches.length} match${
                            contactSearchMatches.length === 1 ? "" : "es"
                          }`}
                        </span>
                        <span className="truncate text-sky-700/80">
                          {profileFilter === "all" ? "All profiles" : activeFilterLabel}
                        </span>
                      </div>

                      {contactSearchMatches.length > 0 ? (
                        <>
                          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                            {contactSearchPreview.map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                                aria-label={`Open ${person.name}`}
                                onClick={() => {
                                  onSelectContact(person.id);
                                  setOpenControl(null);
                                  setRailExpanded(false);
                                }}
                              >
                                <ContactAvatar person={person} size="md" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold text-foreground">
                                    {person.name}
                                  </span>
                                  <span className="block truncate text-[0.68rem] font-medium text-muted-foreground">
                                    {getStageLabel(stages, person.stage)}
                                  </span>
                                </span>
                                <span className="shrink-0 rounded-full bg-sky-100/80 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-sky-700 opacity-80 transition group-hover:opacity-100">
                                  Open
                                </span>
                              </button>
                            ))}
                          </div>
                          {contactSearchMatches.length > contactSearchPreview.length ? (
                            <p className="px-2 pt-2 text-[0.68rem] text-muted-foreground">
                              +{contactSearchMatches.length - contactSearchPreview.length} more shown on the board.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="px-2 py-4 text-center text-xs leading-5 text-muted-foreground">
                          No contacts found for &quot;{search.trim()}&quot;.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                <div id={profileFilterPanelId} className="sr-only" role="tabpanel">
                  Filter by profile
                </div>
              </div>
            ) : null}
          </div>

      {!configured ? (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-950">
          <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-amber-500" />
          <span>
            Add <code className="rounded bg-amber-100 px-1 font-mono text-[0.7rem]">SUPABASE_URL</code>{" "}
            and <code className="rounded bg-amber-100 px-1 font-mono text-[0.7rem]">SUPABASE_SECRET_KEY</code>{" "}
            in Vercel to enable saving.
          </span>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs leading-5 text-destructive">
          <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-destructive" />
          <span>{notice}</span>
        </div>
      ) : null}
      <GraphsModal
        open={settingsMode === "graphs"}
        people={graphPeople}
        profiles={graphProfiles}
        stages={stages}
        onClose={() => setSettingsMode("closed")}
      />
      <EditStackModal
        open={settingsMode === "edit"}
        stages={allStages}
        people={allPeople}
        configured={configured}
        onClose={() => setSettingsMode("closed")}
        onSaved={onStagesChange}
      />
    </header>
  );
}

function NikeSwoosh({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 32 22"
    >
      <path
        d="M3.4 12.7c4.7 2.1 12.3-.7 24.8-8.4-8.5 8.9-17.7 14.3-23.3 14.3-2.4 0-3.9-.9-4.4-2.4-.4-1.3.5-2.7 2.9-3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FollowUpReminderList({
  isVisible,
  items,
  assignmentItems,
  reminderRef,
}: {
  isVisible: boolean;
  items: FollowUpItem[];
  assignmentItems: AssignmentNotificationItem[];
  reminderRef: RefObject<HTMLDivElement | null>;
}) {
  if (!isVisible) {
    return null;
  }

  const visibleAssignmentItems = assignmentItems.slice(0, 4);
  const visibleItems = items.slice(0, 6);
  const totalVisibleCount = visibleAssignmentItems.length + visibleItems.length;
  const remainingCount = assignmentItems.length + items.length - totalVisibleCount;
  const hasNotifications = assignmentItems.length > 0 || items.length > 0;

  return (
    <section
      ref={reminderRef}
      aria-label="Notifications"
      aria-live="polite"
      className="-mt-2 scroll-mt-5 text-[0.72rem] leading-5 text-muted-foreground focus-visible:outline-none sm:-mt-3"
      tabIndex={-1}
    >
      {hasNotifications ? (
        <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
          {visibleAssignmentItems.map((item) => (
            <li key={`assignment-${item.event.id}`} className="flex min-w-0 items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-cyan-500" />
              <span className="truncate font-bold text-foreground">
                {item.assignedProfile.name}
              </span>
              <span className="shrink-0">assigned</span>
              <span className="truncate font-bold text-foreground">{item.person.name}</span>
              {item.actorProfile ? (
                <span className="shrink-0 text-muted-foreground/75">
                  by {item.actorProfile.name}
                </span>
              ) : null}
              <time
                className="shrink-0 font-semibold text-sky-700"
                dateTime={item.event.created_at}
                title={formatDateTime(item.event.created_at)}
              >
                {formatDate(item.event.created_at)}
              </time>
            </li>
          ))}
          {visibleItems.map((item) => (
            <li
              key={`follow-up-${item.person.id}`}
              className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5"
            >
              <span
                className="inline-flex shrink-0 items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-sky-700"
                aria-label={`Missed on ${formatDate(item.missedAt)}`}
              >
                <Phone className="size-3 shrink-0" aria-hidden="true" strokeWidth={2.4} />
                <time
                  className="shrink-0"
                  dateTime={item.missedAt}
                  title={`Follow-up missed: ${formatDateTime(item.missedAt)}. Last activity: ${item.latestActivity.label} at ${formatDateTime(item.latestActivity.value)}`}
                >
                  MISSED · {formatDate(item.missedAt)}
                </time>
              </span>
              <span className="size-1.5 shrink-0 rounded-full bg-sky-500" />
              <span className="min-w-0 truncate font-bold text-foreground">{item.person.name}</span>
              <span className="shrink-0">needs follow-up</span>
              <span className="shrink-0 text-muted-foreground/75">({item.daysQuiet}d quiet)</span>
            </li>
          ))}
          {remainingCount > 0 ? (
            <li className="flex items-center gap-1.5 font-semibold text-muted-foreground/80">
              <span className="size-1.5 rounded-full bg-muted-foreground/45" />
              +{remainingCount} more
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/45" />
          <span>No notifications</span>
        </p>
      )}
    </section>
  );
}

const graphColors = [
  "oklch(0.72 0.15 248)",
  "oklch(0.76 0.13 224)",
  "oklch(0.7 0.12 198)",
  "oklch(0.65 0.13 260)",
  "oklch(0.78 0.1 210)",
  "oklch(0.6 0.12 238)",
];

function monthKey(value: string) {
  return value.slice(0, 7);
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function GraphsModal({
  open,
  people,
  profiles,
  stages,
  onClose,
}: {
  open: boolean;
  people: BoardPerson[];
  profiles: BoardProfile[];
  stages: Stage[];
  onClose: () => void;
}) {
  const [monthFilter, setMonthFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const monthOptions = Array.from(
    new Set([
      ...people.map((person) => monthKey(person.created_at)),
      ...people.flatMap((person) => person.studies.map((study) => monthKey(study.studied_at))),
    ])
  ).sort((a, b) => b.localeCompare(a));
  const filteredGraphPeople = people.filter((person) => {
    const matchesMonth =
      monthFilter === "all" || monthKey(person.created_at) === monthFilter;
    const matchesUser =
      userFilter === "all" || person.assigned_profile_ids.includes(userFilter);

    return matchesMonth && matchesUser;
  });
  const graphData = stages.map((stage, index) => ({
    id: stage.id,
    index: getStageIndex(stages, stage.id),
    label: stage.label,
    count: filteredGraphPeople.filter((person) => person.stage === stage.id).length,
    color: graphColors[index % graphColors.length],
  }));
  const total = graphData.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(1, ...graphData.map((item) => item.count));
  const topStage = graphData.reduce(
    (top, item) => (item.count > top.count ? item : top),
    graphData[0]
  );
  const filteredGraphStudies = filteredGraphPeople.flatMap((person) =>
    person.studies.filter(
      (study) => monthFilter === "all" || monthKey(study.studied_at) === monthFilter
    )
  );
  const totalStudies = filteredGraphStudies.length;
  const averageDays =
    total === 0
      ? 0
      : Math.round(
          filteredGraphPeople.reduce((sum, person) => sum + daysInPipeline(person.created_at), 0) /
            total
        );
  const baptizedCount = filteredGraphPeople.filter((person) => person.stage === "baptized").length;
  const activeUserCount = profiles.filter((profile) =>
    filteredGraphPeople.some((person) => person.assigned_profile_ids.includes(profile.id))
  ).length;
  const dashboardMonthKeys =
    monthFilter === "all"
      ? monthOptions.slice(0, 6).reverse()
      : [monthFilter];
  const dashboardMonths =
    dashboardMonthKeys.length > 0 ? dashboardMonthKeys : [monthKey(new Date().toISOString())];
  const matchesUserFilter = (person: BoardPerson) =>
    userFilter === "all" || person.assigned_profile_ids.includes(userFilter);
  const trendData = dashboardMonths.map((month) => {
    const monthPeople = people.filter(
      (person) => matchesUserFilter(person) && monthKey(person.created_at) === month
    );
    const monthStudies = people
      .filter(matchesUserFilter)
      .flatMap((person) => person.studies)
      .filter((study) => monthKey(study.studied_at) === month);

    return {
      month,
      contacts: monthPeople.length,
      studies: monthStudies.length,
    };
  });
  const maxTrendValue = Math.max(
    1,
    ...trendData.flatMap((item) => [item.contacts, item.studies])
  );
  const contactTrendPoints = trendData
    .map((item, index) => {
      const x = trendData.length === 1 ? 50 : (index / (trendData.length - 1)) * 100;
      const y = 92 - (item.contacts / maxTrendValue) * 76;

      return `${x},${y}`;
    })
    .join(" ");
  const studyTrendPoints = trendData
    .map((item, index) => {
      const x = trendData.length === 1 ? 50 : (index / (trendData.length - 1)) * 100;
      const y = 92 - (item.studies / maxTrendValue) * 76;

      return `${x},${y}`;
    })
    .join(" ");
  const topStudyTitle =
    sortStudies(filteredGraphStudies)
      .at(-1)
      ?.title?.trim() || "No studies logged";
  const userRows = profiles
    .map((profile) => {
      const assignedPeople = filteredGraphPeople.filter((person) =>
        person.assigned_profile_ids.includes(profile.id)
      );
      const studies = assignedPeople.flatMap((person) =>
        person.studies.filter(
          (study) => monthFilter === "all" || monthKey(study.studied_at) === monthFilter
        )
      );
      const averageUserDays =
        assignedPeople.length === 0
          ? 0
          : Math.round(
              assignedPeople.reduce((sum, person) => sum + daysInPipeline(person.created_at), 0) /
                assignedPeople.length
            );

      return {
        profile,
        contacts: assignedPeople.length,
        studies: studies.length,
        averageDays: averageUserDays,
      };
    })
    .filter((item) => item.contacts > 0 || item.studies > 0)
    .sort((a, b) => b.contacts + b.studies - (a.contacts + a.studies));
  const summaryCards = [
    {
      label: "Contacts",
      value: total,
      detail: `${topStage?.label ?? "No stage"} leading`,
      accent: "from-sky-400 to-blue-500",
      spark: contactTrendPoints,
    },
    {
      label: "Bible Studies",
      value: totalStudies,
      detail: topStudyTitle,
      accent: "from-cyan-300 to-sky-500",
      spark: studyTrendPoints,
    },
    {
      label: "Avg Days",
      value: averageDays,
      detail: "in pipeline",
      accent: "from-blue-300 to-cyan-500",
      spark: contactTrendPoints,
    },
    {
      label: "Active Users",
      value: activeUserCount,
      detail: `${baptizedCount} baptized`,
      accent: "from-sky-500 to-cyan-300",
      spark: studyTrendPoints,
    },
  ];

  if (!open) {
    return null;
  }

  return createPortal(
            <motion.div
              aria-modal="true"
              className="fixed inset-0 z-[140] flex items-center justify-center bg-foreground/25 px-3 py-3 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              role="dialog"
            >
              <motion.div
                className="soft-panel-strong flex max-h-[94vh] w-full max-w-[95rem] flex-col overflow-hidden rounded-[1.5rem] border"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex min-w-0 items-center gap-2 border-b border-foreground/10 px-3 py-2 md:gap-3 md:overflow-x-auto md:px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-0 shrink items-baseline gap-3">
                    <span className="hidden text-[0.65rem] font-black uppercase tracking-[0.28em] text-sky-500 md:inline">
                      Graphs
                    </span>
                    <h2 className="truncate font-display text-lg font-black leading-none tracking-display text-foreground md:text-2xl">
                      Pipeline Data
                    </h2>
                  </div>
                  <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 md:min-w-max md:gap-5">
                    <label className="relative flex h-9 min-w-0 items-center md:gap-2">
                      <span className="hidden text-[0.58rem] font-black uppercase tracking-[0.18em] text-sky-600 md:inline">
                        Month
                      </span>
                      <select
                        aria-label="Filter graphs by month"
                        className="w-[5.9rem] appearance-none truncate bg-transparent pr-3 text-xs font-bold text-foreground outline-none focus-visible:text-sky-700 md:w-auto md:min-w-0 md:flex-1 md:pr-0"
                        value={monthFilter}
                        onChange={(event) => setMonthFilter(event.target.value)}
                      >
                        <option value="all">All months</option>
                        {monthOptions.map((month) => (
                          <option key={month} value={month}>
                            {formatMonthLabel(month)}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-0 size-3 rotate-90 text-muted-foreground md:hidden" />
                    </label>
                    <label className="relative flex h-9 min-w-0 items-center md:gap-2">
                      <span className="hidden text-[0.58rem] font-black uppercase tracking-[0.18em] text-sky-600 md:inline">
                        User
                      </span>
                      <select
                        aria-label="Filter graphs by user"
                        className="w-[4.9rem] appearance-none truncate bg-transparent pr-3 text-xs font-bold text-foreground outline-none focus-visible:text-sky-700 md:w-auto md:min-w-0 md:flex-1 md:pr-0"
                        value={userFilter}
                        onChange={(event) => setUserFilter(event.target.value)}
                      >
                        <option value="all">All users</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-0 size-3 rotate-90 text-muted-foreground md:hidden" />
                    </label>
                    <div className="hidden h-9 items-center gap-2 text-xs md:flex">
                      <span className="font-black uppercase tracking-[0.18em] text-sky-600">
                        Top Stage
                      </span>
                      <span className="font-bold text-muted-foreground">
                        {topStage?.label ?? "None"} · {topStage?.count ?? 0}
                      </span>
                    </div>
                    <span className="hidden h-9 items-center text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground md:inline-flex">
                      {total} total
                    </span>
                    <Button
                      aria-label="Close graphs"
                      className="shrink-0"
                      onClick={onClose}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X className="size-5" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 overflow-y-auto p-2.5">
                  <div className="hidden gap-2 md:grid md:grid-cols-4">
                    {summaryCards.map((card) => (
                      <DashboardStatCard
                        key={card.label}
                        accent={card.accent}
                        detail={card.detail}
                        label={card.label}
                        spark={card.spark}
                        value={card.value}
                      />
                    ))}
                  </div>

                  <div className="grid gap-2 md:grid-cols-[1.08fr_0.92fr]">
                    <DashboardPanel
                      action={dashboardMonths.length > 1 ? `${formatMonthLabel(dashboardMonths[0])} - ${formatMonthLabel(dashboardMonths.at(-1) ?? dashboardMonths[0])}` : formatMonthLabel(dashboardMonths[0])}
                      className="hidden md:block"
                      title="Pipeline Survey"
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-3 text-[0.62rem] font-bold text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full bg-sky-500" />
                          New Contacts
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full bg-cyan-400" />
                          Studies Logged
                        </span>
                      </div>
                      <div className="relative h-32 overflow-hidden rounded-2xl bg-white/50 p-3">
                        <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {[16, 35, 54, 73, 92].map((y) => (
                            <line
                              key={y}
                              x1="0"
                              x2="100"
                              y1={y}
                              y2={y}
                              stroke="oklch(0.82 0.02 235 / 0.7)"
                              strokeDasharray="2 2"
                              strokeWidth="0.45"
                            />
                          ))}
                          <polyline
                            fill="none"
                            points={contactTrendPoints}
                            stroke="oklch(0.62 0.2 248)"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.8"
                            vectorEffect="non-scaling-stroke"
                          />
                          <polyline
                            fill="none"
                            points={studyTrendPoints}
                            stroke="oklch(0.76 0.13 224)"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.8"
                            vectorEffect="non-scaling-stroke"
                          />
                          {trendData.map((item, index) => {
                            const x = trendData.length === 1 ? 50 : (index / (trendData.length - 1)) * 100;
                            const contactY = 92 - (item.contacts / maxTrendValue) * 76;
                            const studyY = 92 - (item.studies / maxTrendValue) * 76;

                            return (
                              <g key={item.month}>
                                <circle cx={x} cy={contactY} fill="white" r="2.3" stroke="oklch(0.62 0.2 248)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                                <circle cx={x} cy={studyY} fill="white" r="2.3" stroke="oklch(0.76 0.13 224)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                              </g>
                            );
                          })}
                        </svg>
                        <div className="pointer-events-none absolute inset-x-4 bottom-2 grid" style={{ gridTemplateColumns: `repeat(${trendData.length}, minmax(0, 1fr))` }}>
                          {trendData.map((item) => (
                            <span key={item.month} className="truncate text-center text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                              {formatMonthLabel(item.month).split(" ")[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </DashboardPanel>

                    <DashboardPanel action={`${total} contacts`} flatOnMobile title="Stage Report">
                      <div className="space-y-1">
                        {graphData.map((item) => (
                          <div key={item.id} className="grid grid-cols-[5.8rem_1fr_1.25rem] items-center gap-2">
                            <span className="truncate text-[0.6rem] font-bold text-muted-foreground">
                              {item.label}
                            </span>
                            <div className="soft-inset h-5 overflow-hidden rounded-xl border bg-white/45">
                              <div
                                className="flex h-full items-center rounded-xl px-2 text-[0.52rem] font-black text-white shadow-[0_0_18px_oklch(0.76_0.13_244_/_0.22)]"
                                style={{
                                  width: `${Math.max(10, (item.count / maxCount) * 100)}%`,
                                  background: item.color,
                                }}
                              >
                                {item.index}
                              </div>
                            </div>
                            <span className="text-right text-xs font-black text-foreground">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </DashboardPanel>
                  </div>

                  <div className="grid gap-2 md:grid-cols-[1.15fr_0.85fr]">
                    <DashboardPanel action="all sections" flatOnMobile title="Pipeline Sections">
                      <div className="overflow-hidden border-y border-foreground/10 bg-white/35 md:rounded-2xl md:border md:bg-white/45">
                        <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3rem] gap-2 bg-sky-50/45 px-1.5 py-1.5 text-[0.5rem] font-black uppercase tracking-[0.14em] text-muted-foreground md:grid-cols-[1fr_3.5rem_3.5rem] md:px-3">
                          <span>Section</span>
                          <span className="text-right">People</span>
                          <span className="text-right">Share</span>
                        </div>
                        {graphData.map((item) => {
                          const share = total === 0 ? 0 : Math.round((item.count / total) * 100);

                          return (
                            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_3.25rem_3rem] gap-2 border-t border-foreground/10 px-1.5 py-2 text-[0.7rem] md:grid-cols-[1fr_3.5rem_3.5rem] md:px-3 md:py-1.5">
                              <span className="min-w-0 font-bold text-foreground">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="size-2 rounded-full md:size-2.5" style={{ background: item.color }} />
                                  <span className="truncate">{item.label}</span>
                                </span>
                                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-sky-100/75 md:hidden">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${share}%`,
                                      background: item.color,
                                    }}
                                  />
                                </span>
                              </span>
                              <span className="text-right text-sm font-black leading-6 text-foreground md:text-[0.68rem] md:leading-normal">{item.count}</span>
                              <span className="text-right text-xs font-bold leading-6 text-sky-700 md:text-muted-foreground">{share}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </DashboardPanel>

                    <DashboardPanel action={`${activeUserCount} active`} flatOnMobile title="User Days This Month">
                      <div className="overflow-hidden border-y border-foreground/10 bg-white/30 md:rounded-2xl md:border md:bg-white/45">
                        {userRows.length > 0 ? (
                          <>
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem] gap-2 bg-sky-50/45 px-1.5 py-1.5 text-[0.5rem] font-black uppercase tracking-[0.14em] text-muted-foreground md:px-3">
                              <span className="w-6" aria-hidden="true" />
                              <span>User</span>
                              <span className="text-right">Days</span>
                            </div>
                            {userRows.slice(0, 6).map((item) => (
                              <div key={item.profile.id} className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem] items-center gap-2 border-t border-foreground/10 px-1.5 py-2 md:px-3">
                                <ProfileAvatar profile={item.profile} size="xs" />
                                <div className="min-w-0">
                                  <p className="truncate text-[0.72rem] font-black leading-tight text-foreground">{item.profile.name}</p>
                                  <p className="text-[0.6rem] font-bold text-muted-foreground">
                                    {item.contacts} contacts · {item.studies} studies
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-base font-black leading-none text-sky-700 md:text-sm">{item.averageDays}</p>
                                  <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                    days
                                  </p>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="px-4 py-8 text-center text-sm font-bold text-muted-foreground">
                            No user activity for this filter.
                          </div>
                        )}
                      </div>
                    </DashboardPanel>
                  </div>
                </div>
              </motion.div>
            </motion.div>,
            document.body
  );
}

function EditStackModal({
  open,
  stages,
  people,
  configured,
  onClose,
  onSaved,
}: {
  open: boolean;
  stages: Stage[];
  people: BoardPerson[];
  configured: boolean;
  onClose: () => void;
  onSaved: (stages: Stage[]) => void;
}) {
  const [draftStages, setDraftStages] = useState<Stage[]>(() => normalizeStages(stages));
  const [collapsedStageIds, setCollapsedStageIds] = useState<StageId[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<StageId | null>(null);
  const [deleteCodesByStageId, setDeleteCodesByStageId] = useState<Record<StageId, string>>({});
  const [finalDeleteConfirmId, setFinalDeleteConfirmId] = useState<StageId | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const activeCounts = useMemo(() => {
    const counts = new Map<StageId, number>();

    for (const person of people) {
      counts.set(person.stage, (counts.get(person.stage) ?? 0) + 1);
    }

    return counts;
  }, [people]);
  const collapsedStageSet = useMemo(() => new Set(collapsedStageIds), [collapsedStageIds]);
  const visibleCount = draftStages.filter((stage) => !stage.isHidden).length;
  const allCollapsed =
    draftStages.length > 0 && draftStages.every((stage) => collapsedStageSet.has(stage.id));

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setDraftStages(normalizeStages(stages));
      setCollapsedStageIds([]);
      setConfirmDeleteId(null);
      setDeleteCodesByStageId({});
      setFinalDeleteConfirmId(null);
      setNotice(undefined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, stages]);

  function updateDraftStage(stageId: StageId, patch: Partial<Stage>) {
    setDraftStages((current) =>
      current.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage))
    );
  }

  function moveDraftStage(stageId: StageId, direction: -1 | 1) {
    setDraftStages((current) => {
      const index = current.findIndex((stage) => stage.id === stageId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [stage] = next.splice(index, 1);
      next.splice(targetIndex, 0, stage);

      return next.map((item, itemIndex) => ({
        ...item,
        sortOrder: (itemIndex + 1) * 1000,
      }));
    });
  }

  function toggleDraftStage(stageId: StageId) {
    setCollapsedStageIds((current) =>
      current.includes(stageId)
        ? current.filter((id) => id !== stageId)
        : [...current, stageId]
    );
  }

  function toggleAllDraftStages() {
    setCollapsedStageIds(allCollapsed ? [] : draftStages.map((stage) => stage.id));
    setConfirmDeleteId(null);
    setDeleteCodesByStageId({});
    setFinalDeleteConfirmId(null);
  }

  function addDraftStage() {
    setDraftStages((current) => {
      const label = "New Stack";
      const id = createStageId(label, current.map((stage) => stage.id));
      const next: Stage = {
        id,
        label,
        shortLabel: "New",
        description: "Custom follow-up stage.",
        tone: getFallbackTone(current.length + 1),
        sortOrder: (current.length + 1) * 1000,
        isHidden: false,
        isSystem: false,
      };

      return [...current, next];
    });
    setConfirmDeleteId(null);
    setDeleteCodesByStageId({});
    setFinalDeleteConfirmId(null);
    setNotice("Rename the new stack, then save changes.");
  }

  function requestDeleteStage(stage: Stage) {
    const count = activeCounts.get(stage.id) ?? 0;
    const deleteCode = deleteCodesByStageId[stage.id] ?? "";

    if (stage.isHidden) {
      updateDraftStage(stage.id, { isHidden: false });
      setConfirmDeleteId(null);
      setDeleteCodesByStageId((current) => {
        const next = { ...current };
        delete next[stage.id];

        return next;
      });
      setFinalDeleteConfirmId(null);
      setNotice(`${stage.label} will be restored when you save.`);
      return;
    }

    if (visibleCount <= 1) {
      setNotice("Keep at least one stack visible.");
      return;
    }

    if (count > 0) {
      setNotice(`Move ${count} contact${count === 1 ? "" : "s"} out of ${stage.label} before deleting it.`);
      return;
    }

    if (confirmDeleteId !== stage.id) {
      setConfirmDeleteId(stage.id);
      setDeleteCodesByStageId({ [stage.id]: "" });
      setFinalDeleteConfirmId(null);
      setNotice(`First confirmation: deleting ${stage.label} requires a delete code.`);
      return;
    }

    if (deleteCode !== "1943") {
      setFinalDeleteConfirmId(null);
      setNotice("The delete code did not match.");
      return;
    }

    if (finalDeleteConfirmId !== stage.id) {
      setFinalDeleteConfirmId(stage.id);
      setNotice(`Final confirmation needed before deleting ${stage.label}.`);
      return;
    }

    updateDraftStage(stage.id, { isHidden: true });
    setConfirmDeleteId(null);
    setDeleteCodesByStageId((current) => {
      const next = { ...current };
      delete next[stage.id];

      return next;
    });
    setFinalDeleteConfirmId(null);
    setNotice(`${stage.label} will be hidden after saving.`);
  }

  function handleSave() {
    if (!configured) {
      setNotice("Connect Supabase before editing stacks.");
      return;
    }

    startTransition(async () => {
      const result = await saveStages({ stages: draftStages });

      if (!result.ok || !result.data) {
        setNotice(result.ok ? "Stacks could not be saved." : result.error);
        return;
      }

      onSaved(result.data);
      setNotice(undefined);
      onClose();
    });
  }

  if (!open) {
    return null;
  }

  return createPortal(
    <motion.div
      aria-modal="true"
      className="fixed inset-0 z-[140] flex items-end justify-center bg-foreground/25 px-3 py-3 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
    >
      <motion.div
        className="soft-panel-strong flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-foreground/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.24em] text-sky-500">
              Settings
            </p>
            <h2 className="truncate font-display text-2xl leading-none tracking-display text-foreground">
              Edit Stack
            </h2>
          </div>
          <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5">
            <button
              aria-label={allCollapsed ? "Expand all stacks" : "Collapse all stacks"}
              aria-pressed={allCollapsed}
              className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/75 transition hover:bg-white/70 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:text-foreground/35"
              disabled={isPending || draftStages.length === 0}
              onClick={toggleAllDraftStages}
              title={allCollapsed ? "Expand all stacks" : "Collapse all stacks"}
              type="button"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  allCollapsed ? "rotate-90" : "-rotate-90"
                )}
              />
            </button>
            <button
              aria-label="Add stack"
              className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/80 transition hover:bg-white/70 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:text-foreground/35"
              disabled={isPending}
              onClick={addDraftStage}
              title="Add stack"
              type="button"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <Button
            aria-label="Close edit stack"
            className="shrink-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3">
          <div className="space-y-2">
            {draftStages.map((stage, index) => {
              const tone = stageTones[stage.tone] ?? stageTones.sky;
              const confirmDelete = confirmDeleteId === stage.id;
              const deleteCode = deleteCodesByStageId[stage.id] ?? "";
              const deleteUnlocked = deleteCode === "1943";
              const finalDeleteConfirm = finalDeleteConfirmId === stage.id;
              const collapsed = collapsedStageSet.has(stage.id);
              const fieldsId = `edit-stack-${stage.id}-fields`;

              return (
                <section
                  key={stage.id}
                  className={cn(
                    "py-1.5 transition",
                    stage.isHidden && "opacity-60"
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                    <button
                      aria-controls={fieldsId}
                      aria-expanded={!collapsed}
                      className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-1.5 text-left outline-none transition hover:bg-background/35 focus-visible:ring-2 focus-visible:ring-ring/20"
                      onClick={() => toggleDraftStage(stage.id)}
                      type="button"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-black text-foreground">
                            {stage.label || "Untitled stack"}
                          </span>
                          <span className="shrink-0 rounded-full border border-white/70 bg-white/80 px-1.5 py-0.5 font-display text-xs italic leading-none text-foreground/75">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </span>
                        {stage.isHidden ? (
                          <span className="mt-0.5 block truncate text-[0.68rem] font-bold text-amber-800">
                            Hidden
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          !collapsed && "rotate-90 text-sky-600"
                        )}
                      />
                    </button>

                    <Button
                      aria-label={stage.isHidden ? `Restore ${stage.label}` : `Delete ${stage.label}`}
                      className={cn(
                        "shrink-0",
                        confirmDelete && "border-destructive/50 text-destructive"
                      )}
                      disabled={isPending || (confirmDelete && !deleteUnlocked)}
                      onClick={() => requestDeleteStage(stage)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="size-4" />
                    </Button>

                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <Button
                        aria-label={`Move ${stage.label} up`}
                        disabled={isPending || index === 0}
                        onClick={() => moveDraftStage(stage.id, -1)}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <ChevronRight className="size-4 -rotate-90" />
                      </Button>
                      <Button
                        aria-label={`Move ${stage.label} down`}
                        disabled={isPending || index === draftStages.length - 1}
                        onClick={() => moveDraftStage(stage.id, 1)}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <ChevronRight className="size-4 rotate-90" />
                      </Button>
                    </div>
                  </div>

                  <div
                    id={fieldsId}
                    hidden={collapsed}
                    className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[0.9fr_1.1fr]"
                  >
                    <label className="min-w-0">
                      <span className="mb-0.5 block text-[0.56rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Stack name
                      </span>
                      <input
                        className="soft-inset h-10 w-full rounded-lg border px-2.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                        value={stage.label}
                        onChange={(event) =>
                          updateDraftStage(stage.id, {
                            label: event.target.value,
                            shortLabel: event.target.value.slice(0, 24),
                          })
                        }
                      />
                    </label>

                    <label className="min-w-0">
                      <span className="mb-0.5 block text-[0.56rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Description
                      </span>
                      <input
                        className="soft-inset h-10 w-full rounded-lg border px-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                        value={stage.description}
                        onChange={(event) =>
                          updateDraftStage(stage.id, { description: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  {confirmDelete ? (
                    <div className="mt-2 rounded-[1rem] border border-destructive/35 bg-destructive/10 p-2.5 text-destructive">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em]">
                            {finalDeleteConfirm ? "Final confirmation" : "First confirmation"}
                          </p>
                          <p className="mt-0.5 text-sm font-bold leading-5">
                            If you delete, everything will be deleted permanently.
                          </p>
                        </div>
                        <label className="shrink-0">
                          <span className="mb-0.5 block text-[0.56rem] font-black uppercase tracking-[0.16em]">
                            Delete code
                          </span>
                          <input
                            aria-label={`Delete code for ${stage.label}`}
                            className="h-10 w-full rounded-lg border border-destructive/35 bg-background/80 px-2.5 text-center text-sm font-black tracking-[0.28em] text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/25 sm:w-28"
                            inputMode="numeric"
                            onChange={(event) => {
                              setDeleteCodesByStageId({ [stage.id]: event.target.value.trim() });
                              setFinalDeleteConfirmId(null);
                            }}
                            placeholder="Code"
                            value={deleteCode}
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setDeleteCodesByStageId({});
                            setFinalDeleteConfirmId(null);
                            setNotice(undefined);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Cancel delete
                        </Button>
                        <Button
                          className="border-destructive/40 text-destructive"
                          disabled={!deleteUnlocked || isPending}
                          onClick={() => requestDeleteStage(stage)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Trash2 className="size-4" />
                          {deleteUnlocked
                            ? finalDeleteConfirm
                              ? "Delete this stack"
                              : "Final confirmation"
                            : "Enter code to unlock"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>

        <div className="border-t border-foreground/10 px-4 py-3">
          {notice ? (
            <div className="mb-3 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-xs font-bold leading-5 text-sky-900">
              {notice}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              disabled={isPending}
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="border border-sky-200/70 bg-white/85 text-foreground shadow-[0_1px_0_oklch(1_0_0_/_0.9)_inset] hover:bg-white hover:text-foreground disabled:text-foreground/70"
              disabled={isPending}
              onClick={handleSave}
              type="button"
            >
              {isPending ? "Saving..." : "Save stack"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function DashboardStatCard({
  accent,
  detail,
  label,
  spark,
  value,
}: {
  accent: string;
  detail: string;
  label: string;
  spark: string;
  value: number;
}) {
  return (
    <section className="soft-panel relative min-h-[5.1rem] overflow-hidden rounded-[1rem] border p-2.5">
      <div className="flex items-center gap-2">
        <div className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-[0_12px_24px_-16px_oklch(0.62_0.2_248_/_0.8)]", accent)}>
          <span className="size-2.5 rounded-full bg-white/85 shadow-[0_0_14px_oklch(1_0_0_/_0.9)]" />
        </div>
        <p className="min-w-0 truncate text-[0.62rem] font-bold text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <p className="font-sans text-lg font-black leading-none tracking-tight text-foreground">
          {value.toLocaleString()}
        </p>
        <svg className="h-6 w-14 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            fill="none"
            points={spark}
            stroke="oklch(0.62 0.2 248)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <p className="mt-0.5 line-clamp-1 text-[0.58rem] font-bold text-muted-foreground">
        {detail}
      </p>
    </section>
  );
}

function DashboardPanel({
  action,
  className,
  flatOnMobile = false,
  title,
  children,
}: {
  action?: string;
  className?: string;
  flatOnMobile?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "soft-panel rounded-[1.1rem] border p-2.5",
        flatOnMobile && "mobile-dashboard-panel-flat",
        className
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <h3 className="text-xs font-black tracking-tight text-foreground">{title}</h3>
        {action ? (
          <span className="soft-inset shrink-0 rounded-xl border px-2 py-0.5 text-[0.54rem] font-black uppercase tracking-[0.13em] text-muted-foreground">
            {action}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function JourneyBoard({
  people,
  stages,
  profiles,
  activeProfile,
  configured,
  isPending,
  onMove,
  onNotice,
  onSelect,
  onReactionLogged,
}: {
  people: BoardPerson[];
  stages: Stage[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  isPending: boolean;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-3">
      <div
        className="grid min-h-[42rem] w-max gap-4 xl:w-full"
        style={{
          gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))`,
          minWidth: `${Math.max(1180, stages.length * 196)}px`,
        }}
      >
        {stages.map((stage, index) => {
          const stagePeople = sortPeople(
            people.filter((person) => person.stage === stage.id)
          );

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <StageLane
                stage={stage}
                stages={stages}
                people={stagePeople}
                profiles={profiles}
                activeProfile={activeProfile}
                configured={configured}
                isPending={isPending}
                onMove={onMove}
                onNotice={onNotice}
                onSelect={onSelect}
                onReactionLogged={onReactionLogged}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StackBoard({
  people,
  stages,
  profiles,
  activeProfile,
  configured,
  isPending,
  searchActive,
  onMove,
  onNotice,
  onSelect,
  onReactionLogged,
}: {
  people: BoardPerson[];
  stages: Stage[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  isPending: boolean;
  searchActive: boolean;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
}) {
  const [expandedStages, setExpandedStages] = useState<StackExpandedState>({});
  const [mobileExpandedStageId, setMobileExpandedStageId] = useState<
    StageId | null | undefined
  >(undefined);
  const isMobileStackView = useMediaQuery(MOBILE_STACK_MEDIA_QUERY);
  const defaultMobileExpandedStageId = useMemo(() => {
    return stages.find((stage) => people.some((person) => person.stage === stage.id))?.id ?? null;
  }, [people, stages]);
  const activeMobileStageId = useMemo(() => {
    if (mobileExpandedStageId === null) {
      return null;
    }

    if (mobileExpandedStageId === undefined) {
      return defaultMobileExpandedStageId;
    }

    const stageVisible = stages.some((stage) => stage.id === mobileExpandedStageId);
    const stageHasSearchMatches = people.some(
      (person) => person.stage === mobileExpandedStageId
    );

    if (!stageVisible || (searchActive && !stageHasSearchMatches)) {
      return defaultMobileExpandedStageId;
    }

    return mobileExpandedStageId;
  }, [defaultMobileExpandedStageId, mobileExpandedStageId, people, searchActive, stages]);

  function handleToggleStage(stageId: StageId, currentExpanded: boolean) {
    if (isMobileStackView) {
      setMobileExpandedStageId(currentExpanded ? null : stageId);
      return;
    }

    setExpandedStages((current) => ({
      ...current,
      [stageId]: !currentExpanded,
    }));
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-28 sm:gap-3 sm:pb-10">
      {stages.map((stage, index) => {
        const stagePeople = sortPeople(
          people.filter((person) => person.stage === stage.id)
        );
        const expanded =
          isMobileStackView
            ? activeMobileStageId === stage.id
            : searchActive && stagePeople.length > 0
            ? true
            : Object.prototype.hasOwnProperty.call(expandedStages, stage.id)
              ? expandedStages[stage.id] ?? false
              : stagePeople.length > 0;

        return (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.035, duration: 0.32, ease: "easeOut" }}
          >
            <StackStageSection
              stage={stage}
              stages={stages}
              people={stagePeople}
              profiles={profiles}
              activeProfile={activeProfile}
              configured={configured}
              isPending={isPending}
              expanded={expanded}
              onToggle={() => handleToggleStage(stage.id, expanded)}
              onMove={onMove}
              onNotice={onNotice}
              onSelect={onSelect}
              onReactionLogged={onReactionLogged}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function StackStageSection({
  stage,
  stages,
  people,
  profiles,
  activeProfile,
  configured,
  isPending,
  expanded,
  onToggle,
  onMove,
  onNotice,
  onSelect,
  onReactionLogged,
}: {
  stage: Stage;
  stages: Stage[];
  people: BoardPerson[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  isPending: boolean;
  expanded: boolean;
  onToggle: () => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
}) {
  const contentId = useId();
  const tone = stageTones[stage.tone] ?? stageTones.sky;
  const collapsedPreviewPeople = expanded ? [] : getTopActivePreviewPeople(people);

  return (
    <section
      className={cn(
        "soft-panel mobile-stack-stage-flat relative overflow-visible rounded-none border-0 transition-[background,box-shadow] duration-200 sm:overflow-hidden sm:rounded-[1.6rem] sm:border",
        expanded && "mobile-stack-stage-open"
      )}
    >
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={expanded}
        className={cn(
          "group mobile-stack-stage-header flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/25 sm:rounded-none sm:px-5 sm:py-4 sm:hover:bg-white/35",
          expanded && "mobile-stack-stage-header-open"
        )}
        onClick={onToggle}
      >
        <span
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/60 shadow-[0_1px_0_oklch(1_0_0_/_0.85)_inset]",
            expanded && "stack-stage-number-active"
          )}
        >
          <span className="font-display text-xl italic leading-none text-foreground/45">
            {getStageIndex(stages, stage.id)}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("inline-block size-1.5 shrink-0 rounded-full", tone.dot)} />
            <span className="truncate font-display text-2xl leading-none tracking-display text-foreground">
              {stage.label}
            </span>
          </span>
          <span className="mt-1 hidden truncate text-xs font-medium text-muted-foreground sm:block">
            {stage.description}
          </span>
          {collapsedPreviewPeople.length > 0 ? (
            <span className="mt-2 flex h-4 items-center sm:hidden">
              <span className="sr-only">
                Top active contacts: {collapsedPreviewPeople.map((person) => person.name).join(", ")}
              </span>
              <span aria-hidden className="flex -space-x-1">
                {collapsedPreviewPeople.map((person) => (
                  <span
                    key={person.id}
                    className="inline-flex rounded-full ring-2 ring-white/80"
                  >
                    <ContactAvatar person={person} size="xs" />
                  </span>
                ))}
              </span>
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "mobile-stack-stage-count inline-flex min-w-7 flex-col items-end justify-center gap-1 font-display text-3xl leading-none tracking-display sm:min-w-11 sm:items-center sm:gap-0 sm:rounded-2xl sm:border sm:border-white/70 sm:bg-white/70 sm:px-3 sm:py-1.5 sm:text-2xl sm:shadow-[0_1px_0_oklch(1_0_0_/_0.85)_inset]",
              expanded && "mobile-stack-stage-count-open",
              tone.text
            )}
          >
            <span>{people.length}</span>
            <span aria-hidden className="mobile-stack-stage-count-accent h-0.5 w-5 rounded-full sm:hidden" />
          </span>
          <span
            aria-hidden
            className={cn(
              "mobile-stack-stage-chevron inline-flex size-9 items-center justify-center rounded-full border transition sm:hidden",
              expanded && "mobile-stack-stage-chevron-open"
            )}
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform duration-200",
                expanded && "rotate-90"
              )}
            />
          </span>
          <ChevronRight
            aria-hidden
            className={cn(
              "hidden size-5 text-muted-foreground transition-transform duration-200 sm:block",
              expanded && "rotate-90 text-sky-600"
            )}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="px-0 pb-1 pt-0 sm:border-t sm:border-foreground/[0.07] sm:p-4">
              {people.length > 0 ? (
                <SortableContext
                  items={people.map((person) => person.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid grid-cols-1 gap-x-4 gap-y-0 lg:grid-cols-2 2xl:grid-cols-3">
                    {people.map((person) => (
                      <SortablePersonCard
                        key={person.id}
                        person={person}
                        profiles={profiles}
                        stages={stages}
                        activeProfile={activeProfile}
                        configured={configured}
                        disabled={isPending}
                        sortableDisabled
                        onMove={onMove}
                        onNotice={onNotice}
                        onSelect={onSelect}
                        onReactionLogged={onReactionLogged}
                      />
                    ))}
                  </div>
                </SortableContext>
              ) : (
                <div className="soft-inset flex min-h-32 flex-col items-center justify-center gap-3 rounded-[1.3rem] border border-dashed p-6 text-center">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-foreground/40",
                      tone.soft
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", tone.dot)} />
                  </span>
                  <p className="font-display text-base italic leading-snug text-foreground/80">
                    {getEmptyStageMessage(stage)}
                  </p>
                  <p className="text-[0.7rem] leading-5 text-muted-foreground">
                    Add a card or move someone here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function StageLane({
  stage,
  stages,
  people,
  profiles,
  activeProfile,
  configured,
  isPending,
  onMove,
  onNotice,
  onSelect,
  onReactionLogged,
}: {
  stage: Stage;
  stages: Stage[];
  people: BoardPerson[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  isPending: boolean;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const tone = stageTones[stage.tone] ?? stageTones.sky;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "soft-panel group/lane relative flex h-full min-h-[42rem] w-[82vw] max-w-[22rem] flex-col rounded-[1.6rem] border transition-all md:w-auto md:max-w-none",
        isOver && "ring-2 ring-sky-300/55 ring-offset-2 ring-offset-background"
      )}
    >
      <div className="relative flex items-start justify-between gap-4 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-display text-2xl italic leading-none text-foreground/40">
              {getStageIndex(stages, stage.id)}
            </span>
            <span className={cn("inline-block size-1.5 shrink-0 rounded-full", tone.dot)} />
            <h2 className="min-w-0 truncate font-display text-2xl leading-[0.95] tracking-display text-foreground">
              {stage.label}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "font-display text-[2.5rem] leading-none tracking-display",
              tone.text
            )}
          >
            {people.length}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col">
        <div className="mx-5 h-px bg-foreground/[0.07]" />
        <SortableContext
          items={people.map((person) => person.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-1 flex-col gap-0 px-3 py-2">
            {people.map((person) => (
              <SortablePersonCard
                key={person.id}
                person={person}
                profiles={profiles}
                stages={stages}
                activeProfile={activeProfile}
                configured={configured}
                disabled={isPending}
                onMove={onMove}
                onNotice={onNotice}
                onSelect={onSelect}
                onReactionLogged={onReactionLogged}
              />
            ))}
            {people.length === 0 ? (
              <div className="soft-inset flex min-h-44 flex-col items-center justify-center gap-3 rounded-[1.3rem] border border-dashed p-6 text-center">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-foreground/40",
                    tone.soft
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", tone.dot)} />
                </span>
                <p className="font-display text-base italic leading-snug text-foreground/80">
                  {getEmptyStageMessage(stage)}
                </p>
                <p className="text-[0.7rem] leading-5 text-muted-foreground">
                  Add a card or drag someone here.
                </p>
              </div>
            ) : null}
          </div>
        </SortableContext>
      </div>
    </section>
  );
}

function QuickAddContactDialog({
  open,
  profiles,
  activeProfile,
  stages,
  configured,
  onClose,
  onCreated,
  onProfilesChange,
  onNotice,
}: {
  open: boolean;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  stages: Stage[];
  configured: boolean;
  onClose: () => void;
  onCreated: (person: BoardPerson) => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  onNotice: (message?: string) => void;
}) {
  const [stage, setStage] = useState<StageId>(stages[0]?.id ?? "hunting");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(() =>
    activeProfile ? [activeProfile.id] : []
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setStage(stages[0]?.id ?? "hunting");
      setSelectedProfileIds(activeProfile ? [activeProfile.id] : []);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeProfile, open, stages]);

  function handleSubmit(formData: FormData) {
    if (!configured) {
      onNotice("Connect Supabase before adding people.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before adding people.");
      return;
    }

    startTransition(async () => {
      const result = await createPerson({
        name: String(formData.get("name") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        stage,
        assignedProfileIds: selectedProfileIds,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The person could not be created." : result.error);
        return;
      }

      onNotice(undefined);
      onCreated(result.data);
      onClose();
    });
  }

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/35 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <form
        action={handleSubmit}
        className="soft-panel-strong w-full max-w-md rounded-lg border p-4 text-slate-950 dark:text-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative mb-4 flex items-center justify-center">
          <h2 className="text-center font-display text-3xl leading-none tracking-display">
            New Contacts
          </h2>
          <button
            aria-label="Close add contact"
            className="soft-control absolute right-0 inline-flex size-9 items-center justify-center rounded-md border text-slate-700 transition hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 dark:text-muted-foreground dark:hover:text-sky-200"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            name="name"
            placeholder="Full name"
            className="soft-inset h-12 w-full rounded-md border px-4 text-sm font-medium tracking-tight text-slate-950 outline-none placeholder:text-slate-900/70 focus-visible:ring-2 focus-visible:ring-ring/20 dark:text-foreground dark:placeholder:text-muted-foreground"
          />
          <select
            aria-label="Starting stage"
            className="soft-inset h-12 w-full rounded-md border px-4 text-sm font-medium tracking-tight text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-ring/20 dark:text-foreground"
            onChange={(event) => {
              if (stages.some((item) => item.id === event.target.value)) {
                setStage(event.target.value);
              }
            }}
            value={stage}
          >
            {stages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <ProfileAssignmentPicker
            profiles={profiles}
            selectedIds={selectedProfileIds}
            onChange={setSelectedProfileIds}
            onProfilesChange={onProfilesChange}
            shape="square"
            highContrastText
          />
          <textarea
            name="notes"
            placeholder="Care notes (optional)"
            rows={3}
            className="soft-inset w-full resize-none rounded-md border px-4 py-3 text-sm leading-5 text-slate-950 outline-none placeholder:text-slate-900/70 focus-visible:ring-2 focus-visible:ring-ring/20 dark:text-foreground dark:placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            className="rounded-md text-slate-950 hover:text-sky-800 disabled:text-slate-950 dark:text-foreground dark:hover:text-sky-200"
            disabled={isPending}
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="rounded-md text-slate-950 hover:text-sky-800 disabled:text-slate-950 disabled:opacity-60 dark:text-foreground dark:hover:text-sky-200"
            disabled={isPending || selectedProfileIds.length < 1}
            type="submit"
          >
            Save contact
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function SortablePersonCard({
  person,
  profiles,
  stages,
  activeProfile,
  configured,
  disabled,
  sortableDisabled,
  onMove,
  onNotice,
  onSelect,
  onReactionLogged,
}: {
  person: BoardPerson;
  profiles: BoardProfile[];
  stages: Stage[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  disabled?: boolean;
  sortableDisabled?: boolean;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: person.id, disabled: sortableDisabled });
  const [collapsed, setCollapsed] = useState(true);
  const previousStage = getNextStage(stages, person.stage, -1);
  const nextStage = getNextStage(stages, person.stage, 1);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignedProfiles = getAssignedProfiles(person, profiles);
  const hasFollowUp = Boolean(person.next_follow_up_at);
  const latestReaction = getLatestContactReaction(person.events);
  const latestStudy = getLatestCompletedStudy(person.studies);
  const latestStudyTitle = latestStudy ? getStudyTitle(latestStudy) : null;
  const latestStudyDate = latestStudy
    ? latestStudy.studied_at ?? latestStudy.created_at
    : null;
  const collapsedStudyLabel = latestStudyTitle
    ? `Last study: ${latestStudyTitle}`
    : "No study documented";
  const collapsedStudyAriaLabel = latestStudyTitle
    ? `Last documented study: ${latestStudyTitle}${
        latestStudyDate ? `, ${formatDate(latestStudyDate)}` : ""
      }`
    : collapsedStudyLabel;
  const totalStudies = person.studies.length;
  const overdueReaction = isReactionOverdue(latestReaction);
  const assignedProfileNames = assignedProfiles.map((profile) => profile.name).join(", ");
  const starToggleButton = (
    <button
      aria-label={collapsed ? `Expand ${person.name}` : `Collapse ${person.name}`}
      aria-pressed={!collapsed}
      className={cn(
        "contact-star-button inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95",
        collapsed
          ? "contact-star-glass border-sky-200/70 text-sky-800/80"
          : "contact-star-active border-blue-900/70 text-white"
      )}
      onClick={() => setCollapsed((value) => !value)}
      type="button"
    >
      <Star className={cn("contact-star-icon size-4", !collapsed && "fill-current")} />
    </button>
  );

  const isActive = !collapsed;

  return (
    <motion.article
      ref={setNodeRef}
      style={{ ...style, borderBottomColor: "rgba(163, 177, 198, 0.35)" }}
      className={cn(
        "group relative overflow-visible border-b bg-transparent transition-colors last:border-b-0 hover:bg-white/50 focus-within:bg-white/40",
        isActive && "bg-white/45",
        overdueReaction && !isActive && "bg-white/30",
        isDragging && "opacity-40"
      )}
      whileTap={{ scale: 0.995 }}
    >
      {isActive || overdueReaction ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1.5 left-0 w-1 rounded-full",
            isActive && "neu-accent-fill"
          )}
          style={!isActive && overdueReaction ? { background: "var(--neu-danger)" } : undefined}
        />
      ) : null}

      {collapsed ? (
        <div className="relative flex min-h-[3.45rem] items-center py-1.5 pl-2 pr-10 sm:min-h-[3.65rem]">
          <button
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 pr-2 text-left transition hover:bg-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            onClick={() => onSelect(person.id)}
            type="button"
          >
            <ContactAvatarSlot person={person} />
            <span className="min-w-0 flex-1">
              <h3 className="truncate font-display text-lg leading-none tracking-display text-foreground">
                {person.name}
              </h3>
              <span
                className={cn(
                  "mt-1 flex min-w-0 items-center text-[0.68rem] font-semibold leading-none tracking-[0.05em]",
                  latestStudyTitle ? "text-[var(--neu-text)]" : "contact-no-study"
                )}
                aria-label={collapsedStudyAriaLabel}
              >
                <span className="truncate">{collapsedStudyLabel}</span>
              </span>
            </span>
          </button>
          <span className="absolute inset-y-0 right-1 flex items-center justify-center">
            {starToggleButton}
          </span>
        </div>
      ) : (
        <>
          <div className="relative flex min-h-[3.65rem] items-center gap-3 px-2 py-2 pr-1.5">
            <button
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              type="button"
              onClick={() => onSelect(person.id)}
            >
              <ContactAvatarSlot person={person} />
              <span className="min-w-0 flex-1">
                <h3 className="truncate font-display text-xl leading-none tracking-display text-foreground transition group-hover:text-foreground">
                  {person.name}
                </h3>
                <span
                  className="mt-0.5 flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-sky-700/85"
                  title={`${totalStudies} total studies`}
                  aria-label={`${totalStudies} total studies`}
                >
                  <span className="font-sans text-sm leading-none tracking-tight text-sky-600">
                    {totalStudies}
                  </span>
                  <span>{totalStudies === 1 ? "study" : "studies"} done</span>
                </span>
              </span>
            </button>
            {starToggleButton}
          </div>

          <div className="relative px-3 pb-3 pl-[4.5rem]">
            {hasFollowUp ? (
              <span className="mb-2 inline-flex shrink-0 rounded-full bg-foreground/[0.04] px-2 py-0.5 text-[0.6rem] font-medium tracking-[0.12em] text-foreground/70">
                {formatDate(person.next_follow_up_at)}
              </span>
            ) : null}

            {latestStudy ? (
              <p className="line-clamp-2 border-l-2 border-foreground/10 pl-3 text-[0.78rem] leading-5 text-muted-foreground">
                <span className="font-medium text-foreground/80">Last study:</span>{" "}
                {latestStudyTitle}
                <span className="text-foreground/40"> · </span>
                <span>{formatDate(latestStudy.studied_at)}</span>
              </p>
            ) : null}

            {person.stage === "baptized" && person.baptized_at ? (
              <p className="mt-2 text-[0.62rem] font-medium uppercase tracking-[0.2em] text-amber-700">
                Baptized {new Date(person.baptized_at).toLocaleDateString()}
              </p>
            ) : null}
          </div>

          <div className="relative flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-950/10 px-2 py-2 pl-[4.5rem]">
            {assignedProfiles.length > 0 ? (
              <div
                aria-label={`Assigned to ${assignedProfileNames}`}
                className="absolute left-3.5 top-1/2 flex w-[3.25rem] -translate-y-1/2 justify-center"
                title={`Assigned to ${assignedProfileNames}`}
              >
                <div className="flex -space-x-2">
                  {assignedProfiles.slice(0, 3).map((profile) => (
                    <ProfileAvatar key={profile.id} profile={profile} size="xs" />
                  ))}
                </div>
              </div>
            ) : (
              <span className="shrink-0 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Unassigned
              </span>
            )}

            {latestReaction ? (
              <div className="flex min-w-0 flex-1 basis-40 items-center gap-1 text-[0.66rem] font-medium text-muted-foreground">
                {latestReaction.event_type === "text_reaction" ? (
                  <MessageCircle className="size-3.5 shrink-0 text-foreground/70" />
                ) : (
                  <Phone className="size-3.5 shrink-0 text-foreground/70" />
                )}
                <span className="min-w-0 truncate uppercase tracking-[0.14em]">
                  {getContactReactionDisplayTitle(latestReaction)}
                </span>
                <span className="shrink-0 text-foreground/25">·</span>
                <span className="shrink-0 tracking-normal text-foreground/60">
                  {formatDate(latestReaction.created_at)}
                </span>
              </div>
            ) : null}

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <ContactReactionControls
                person={person}
                activeProfile={activeProfile}
                configured={configured}
                disabled={disabled}
                onNotice={onNotice}
                onReactionLogged={onReactionLogged}
                compact
              />
              <span className="h-5 w-px bg-foreground/[0.08]" />
              <Button
                aria-label={`Move ${person.name} backward`}
                disabled={!configured || disabled || !previousStage}
                onClick={() => previousStage && onMove(person, previousStage)}
                size="icon-sm"
                type="button"
                variant="ghost"
                className="size-7 rounded-full"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                aria-label={`Move ${person.name} forward`}
                disabled={!configured || disabled || !nextStage}
                onClick={() => nextStage && onMove(person, nextStage)}
                size="icon-sm"
                type="button"
                variant="ghost"
                className="size-7 rounded-full"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.article>
  );
}

function CardPreview({
  person,
  profiles,
  stages,
}: {
  person: BoardPerson;
  profiles: BoardProfile[];
  stages: Stage[];
}) {
  const tone = getStageTone(stages, person.stage);
  return (
    <article
      className="relative w-72 rotate-1 overflow-hidden border-y border-foreground/[0.08] bg-card/70 p-3 shadow-[0_18px_42px_-26px_oklch(0.2_0.028_264_/_0.35)]"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full opacity-60",
          tone.dot
        )}
      />
      <div className="relative flex items-center gap-3">
        <ContactAvatar person={person} size="row" />
        <span className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-none tracking-display">{person.name}</p>
          <p className="mt-1 truncate text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {profileNames(person, profiles)}
          </p>
        </span>
        <ProfileStack profiles={getAssignedProfiles(person, profiles)} className="shrink-0" />
      </div>
    </article>
  );
}

function PersonDetailPanel({
  person,
  profiles,
  activeProfile,
  stages,
  configured,
  onClose,
  onUpdated,
  onDeleted,
  onProfilesChange,
  onNotice,
  onStudyLogged,
  onStudyRenamed,
  onStudyDeleted,
}: {
  person: BoardPerson | null;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  stages: Stage[];
  configured: boolean;
  onClose: () => void;
  onUpdated: (person: BoardPerson) => void;
  onDeleted: (personId: string) => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  onNotice: (message?: string) => void;
  onStudyLogged: (
    personId: string,
    study: PersonStudy,
    event: PersonEvent
  ) => void;
  onStudyRenamed: (personId: string, study: PersonStudy) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(
    person?.assigned_profile_ids ?? []
  );
  const [detailNotes, setDetailNotes] = useState(person?.notes ?? "");
  const [detailTabsCollapsed, setDetailTabsCollapsed] = useState(false);
  const [assignmentPopupOpen, setAssignmentPopupOpen] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(person?.name ?? "");
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1 | 2>(0);
  const [studySelection, setStudySelection] = useState<{
    studyNumber: number;
    focusKey: number;
  } | null>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const deleteConfirmId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isCommittingNameRef = useRef(false);
  const skipNextNameBlurRef = useRef(false);
  const savedDetailNotesRef = useRef(person?.notes ?? "");
  const savedDetailProfileIdsRef = useRef<string[]>(person?.assigned_profile_ids ?? []);
  const detailDraftRef = useRef({
    notes: person?.notes ?? "",
    assignedProfileIds: person?.assigned_profile_ids ?? [],
  });
  const isSavingDetailsRef = useRef(false);
  const pendingDetailsSaveRef = useRef(false);

  useEffect(() => {
    if (!isNameEditing) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isNameEditing]);

  useEffect(() => {
    if (!person) {
      return;
    }

    const notes = person.notes ?? "";
    const frame = window.requestAnimationFrame(() => {
      setSelectedProfileIds(person.assigned_profile_ids);
      setDetailNotes(notes);
      setDeleteConfirmStep(0);
    });

    savedDetailNotesRef.current = notes;
    savedDetailProfileIdsRef.current = person.assigned_profile_ids;
    detailDraftRef.current = {
      notes,
      assignedProfileIds: person.assigned_profile_ids,
    };

    return () => window.cancelAnimationFrame(frame);
  }, [person]);

  function canEditPerson() {
    if (!person) {
      return false;
    }

    if (!configured) {
      onNotice("Connect Supabase before editing people.");
      return false;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before editing people.");
      return false;
    }

    return true;
  }

  function saveContactDetails(
    nextNotes = detailDraftRef.current.notes,
    nextProfileIds = detailDraftRef.current.assignedProfileIds
  ) {
    detailDraftRef.current = {
      notes: nextNotes,
      assignedProfileIds: nextProfileIds,
    };

    if (
      nextNotes === savedDetailNotesRef.current &&
      sameIds(nextProfileIds, savedDetailProfileIdsRef.current)
    ) {
      return;
    }

    if (!canEditPerson() || !person || !activeProfile) {
      return;
    }

    if (isSavingDetailsRef.current) {
      pendingDetailsSaveRef.current = true;
      return;
    }

    isSavingDetailsRef.current = true;

    startTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        notes: nextNotes,
        assignedProfileIds: nextProfileIds,
        actorProfileId: activeProfile.id,
      });

      isSavingDetailsRef.current = false;

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The person could not be updated." : result.error);
        return;
      }

      const savedNotes = result.data.notes ?? "";
      const savedProfileIds = result.data.assigned_profile_ids;

      onNotice(undefined);
      savedDetailNotesRef.current = savedNotes;
      savedDetailProfileIdsRef.current = savedProfileIds;

      const latestDraft = {
        notes: detailDraftRef.current.notes === nextNotes ? savedNotes : detailDraftRef.current.notes,
        assignedProfileIds: sameIds(detailDraftRef.current.assignedProfileIds, nextProfileIds)
          ? savedProfileIds
          : detailDraftRef.current.assignedProfileIds,
      };

      detailDraftRef.current = latestDraft;
      setDetailNotes(latestDraft.notes);
      setSelectedProfileIds(latestDraft.assignedProfileIds);
      onUpdated(result.data);

      pendingDetailsSaveRef.current = false;

      if (
        latestDraft.notes !== savedDetailNotesRef.current ||
        !sameIds(latestDraft.assignedProfileIds, savedDetailProfileIdsRef.current)
      ) {
        saveContactDetails(latestDraft.notes, latestDraft.assignedProfileIds);
      }
    });
  }

  function startNameEdit() {
    if (!canEditPerson() || !person) {
      return;
    }

    setNameDraft(person.name);
    setIsNameEditing(true);
  }

  function cancelNameEdit() {
    if (person) {
      setNameDraft(person.name);
    }

    setIsNameEditing(false);
    onNotice(undefined);
  }

  function refocusNameInput() {
    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  }

  function startDeleteConfirmation() {
    if (!canEditPerson() || !person) {
      return;
    }

    setDeleteConfirmStep(1);
    onNotice(undefined);
  }

  function cancelDeleteConfirmation() {
    setDeleteConfirmStep(0);
    onNotice(undefined);
  }

  function confirmPermanentDelete() {
    if (!canEditPerson() || !person || !activeProfile) {
      return;
    }

    const personId = person.id;

    startDeleteTransition(async () => {
      const result = await deletePerson(personId, activeProfile.id);

      if (!result.ok || !result.data) {
        setDeleteConfirmStep(0);
        onNotice(result.ok ? "The contact could not be deleted." : result.error);
        return;
      }

      onNotice(undefined);
      setDeleteConfirmStep(0);
      onDeleted(result.data.id);
    });
  }

  function commitNameEdit() {
    if (!canEditPerson() || !person || !activeProfile || isCommittingNameRef.current) {
      return;
    }

    const nextName = nameDraft.trim();

    if (!nextName) {
      onNotice("A card needs a name.");
      refocusNameInput();
      return;
    }

    if (nextName === person.name) {
      setNameDraft(person.name);
      setIsNameEditing(false);
      onNotice(undefined);
      return;
    }

    isCommittingNameRef.current = true;

    startTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        name: nextName,
        actorProfileId: activeProfile.id,
      });

      isCommittingNameRef.current = false;

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The person could not be renamed." : result.error);
        refocusNameInput();
        return;
      }

      onNotice(undefined);
      onUpdated(result.data);
      setNameDraft(result.data.name);
      setIsNameEditing(false);
    });
  }

  function handleSwipeEnd(clientX: number) {
    if (swipeStartX === null) {
      return;
    }

    const deltaX = clientX - swipeStartX;
    setSwipeStartX(null);

    if (Math.abs(deltaX) < 48) {
      return;
    }
  }

  function handleStudyShortcut(studyNumber: number) {
    setStudySelection((current) => ({
      studyNumber,
      focusKey: (current?.focusKey ?? 0) + 1,
    }));
  }

  function handleAssignClick() {
    if (selectedProfileIds.length === 0) {
      setSelectedProfileIds(person?.assigned_profile_ids ?? []);
    }
    setAssignmentPopupOpen(true);
  }

  function handleAssignProfile(profileId: string) {
    if (!person) {
      return;
    }

    const nextProfileIds = [profileId];

    if (sameIds(nextProfileIds, assignmentProfileIds)) {
      return;
    }

    setSelectedProfileIds(nextProfileIds);
    saveContactDetails(detailNotes, nextProfileIds);
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !person || !activeProfile) {
      return;
    }

    try {
      const avatarUrl = await fileToAvatarDataUrl(file);

      startAvatarTransition(async () => {
        const result = await updatePersonAvatar(person.id, avatarUrl, activeProfile.id);

        if (!result.ok || !result.data) {
          onNotice(result.ok ? "Could not update contact photo." : result.error);
          return;
        }

        onNotice(undefined);
        onUpdated(result.data);
      });
    } catch (avatarError) {
      onNotice(
        avatarError instanceof Error ? avatarError.message : "Could not update contact photo."
      );
    }
  }

  const detailOwnerProfile = person
    ? profiles.find(
        (profile) =>
          profile.id ===
          person.events.find((event) => event.event_type === "created")?.actor_profile_id
      ) ??
      getAssignedProfiles(person, profiles)[0] ??
      null
    : null;
  const detailStage = person ? getStageById(stages, person.stage) : null;
  const detailStageTone = person ? getStageTone(stages, person.stage) : stageTones.sky;
  const assignmentProfileIds =
    selectedProfileIds.length > 0 ? selectedProfileIds : person?.assigned_profile_ids ?? [];
  const currentAssignmentProfileId = assignmentProfileIds[0] ?? null;

  return (
    <AnimatePresence>
      {person ? (
        <>
          <motion.button
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.aside
            className="soft-panel-strong fixed inset-2 z-50 overflow-y-auto rounded-[1.75rem] border md:inset-y-4 md:left-auto md:right-4 md:w-[30rem] xl:w-[48rem]"
            initial={{ opacity: 0, x: 40, scale: 0.99 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.99 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative flex min-h-[calc(100%-0px)] flex-col">
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b opacity-90",
                  detailStageTone.glow
                )}
              />
              <div className="relative border-b border-foreground/[0.07] px-6 pb-5 pt-6">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleAvatarChange}
                />
                <div className="min-w-0">
                    <div className="mb-3 flex w-full flex-col items-start justify-start gap-2 pr-20 text-left uppercase text-muted-foreground">
                      <div className="flex max-w-full flex-wrap items-center justify-start gap-2 text-[0.66rem] font-semibold tracking-[0.28em] sm:tracking-[0.38em]">
                      <span
                        className={cn("size-1.5 rounded-full", detailStageTone.dot)}
                      />
                      <span className="whitespace-nowrap">
                        {getStageIndex(stages, person.stage)} ·{" "}
                        {detailStage?.label ?? person.stage}
                      </span>
                      {detailOwnerProfile ? (
                        <span className="hidden text-foreground/25 sm:inline">/</span>
                      ) : null}
                      </div>
                      {detailOwnerProfile ? (
                        <div className="flex max-w-full flex-wrap items-center justify-start gap-2 text-[0.66rem] font-black tracking-[0.3em] sm:tracking-[0.38em]">
                          <span className="max-w-[12rem] truncate sm:max-w-[18rem]">
                            {detailOwnerProfile.name}
                          </span>
                            <button
                              type="button"
                              aria-label={`Assign ${person.name}`}
                              className="soft-control group/assign inline-flex h-8 items-center gap-2 rounded-sm border px-2.5 pr-3 text-[0.58rem] font-black uppercase tracking-[0.22em] text-foreground transition hover:-translate-y-0.5 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                              onClick={handleAssignClick}
                              title="Assign profiles"
                            >
                              <span className="baby-blue-button inline-flex size-5 items-center justify-center rounded-sm transition group-hover/assign:scale-105">
                                <Plus className="size-3" />
                              </span>
                              <span>Assign</span>
                            </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex w-full min-w-0 items-center gap-3">
                      <button
                        aria-label={`Change photo for ${person.name}`}
                        className="group/avatar relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isAvatarPending || !activeProfile}
                        onClick={() => avatarInputRef.current?.click()}
                        title="Add contact photo"
                        type="button"
                      >
                        <ContactAvatar person={person} size="lg" />
                        <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-background opacity-0 transition group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
                          <Camera className="size-3" />
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        {isNameEditing ? (
                          <input
                            ref={nameInputRef}
                            aria-label="Contact name"
                            className="soft-inset block w-full min-w-0 max-w-none rounded-xl border px-3 py-1.5 font-display text-[clamp(1.35rem,5vw,2.25rem)] leading-[1.05] tracking-display text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/15 sm:text-[clamp(1.65rem,3.5vw,2.45rem)]"
                            disabled={isPending}
                            onBlur={() => {
                              if (skipNextNameBlurRef.current) {
                                skipNextNameBlurRef.current = false;
                                return;
                              }

                              commitNameEdit();
                            }}
                            onChange={(event) => setNameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitNameEdit();
                              }

                              if (event.key === "Escape") {
                                event.preventDefault();
                                skipNextNameBlurRef.current = true;
                                cancelNameEdit();
                              }
                            }}
                            value={nameDraft}
                          />
                        ) : (
                          <h2 className="min-w-0 font-display text-[clamp(1.35rem,5vw,2.25rem)] leading-[1.05] tracking-display text-foreground sm:text-[clamp(1.65rem,3.5vw,2.45rem)]">
                            <button
                              type="button"
                              aria-label={`Rename ${person.name}`}
                              className="-mx-1 block min-w-0 max-w-full whitespace-normal break-words rounded-xl px-1 text-left outline-none transition hover:bg-background/45 focus-visible:ring-2 focus-visible:ring-ring/20 [overflow-wrap:break-word] [text-wrap:balance]"
                              onDoubleClick={startNameEdit}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  startNameEdit();
                                }
                              }}
                              title="Double-click to rename"
                            >
                              {person.name}
                            </button>
                          </h2>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="absolute right-6 top-6 flex shrink-0 items-start gap-2">
                  <span className="relative flex shrink-0 items-center text-sky-500">
                    <button
                      type="button"
                      aria-controls={deleteConfirmStep ? deleteConfirmId : undefined}
                      aria-expanded={deleteConfirmStep > 0}
                      aria-label={`Delete ${person.name}`}
                      className="soft-control inline-flex size-7 items-center justify-center rounded-full border text-sky-500 transition hover:-translate-y-0.5 hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isDeletePending}
                      onClick={startDeleteConfirmation}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <AnimatePresence>
                      {deleteConfirmStep > 0 ? (
                        <motion.div
                          id={deleteConfirmId}
                          role="alertdialog"
                          aria-label={`Confirm deleting ${person.name}`}
                          className="soft-panel-strong absolute right-0 top-9 z-20 w-60 rounded-2xl border p-3 text-left text-foreground shadow-2xl"
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: "easeOut" }}
                        >
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-red-600">
                            {deleteConfirmStep === 1
                              ? "Delete this contact?"
                              : "Delete permanently?"}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                            {deleteConfirmStep === 1
                              ? "This requires one more confirmation."
                              : "This permanently removes the contact and their activity."}
                          </p>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-foreground/10 px-3 py-1 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-muted-foreground transition hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                              onClick={cancelDeleteConfirmation}
                            >
                              Cancel
                            </button>
                            {deleteConfirmStep === 1 ? (
                              <button
                                type="button"
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.16em] text-red-700 transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20"
                                onClick={() => setDeleteConfirmStep(2)}
                              >
                                Yes
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded-full bg-red-600 px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.16em] text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={isDeletePending}
                                onClick={confirmPermanentDelete}
                              >
                                {isDeletePending ? "Deleting" : "Yes"}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </span>
                  <Button onClick={onClose} size="icon" type="button" variant="ghost">
                    <X className="size-5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <section
                  className="relative overflow-visible"
                  onPointerDown={(event) => setSwipeStartX(event.clientX)}
                  onPointerUp={(event) => handleSwipeEnd(event.clientX)}
                  onPointerCancel={() => setSwipeStartX(null)}
                  onTouchStart={(event) => setSwipeStartX(event.touches[0]?.clientX ?? null)}
                  onTouchEnd={(event) => handleSwipeEnd(event.changedTouches[0]?.clientX ?? 0)}
                >
                  <div
                    className={cn(
                      "relative flex items-center justify-center",
                      !detailTabsCollapsed && "mb-4"
                    )}
                  >
                    <button
                      aria-label={
                        detailTabsCollapsed
                          ? "Expand assigned profiles and Bible studies"
                          : "Collapse assigned profiles and Bible studies"
                      }
                      aria-pressed={!detailTabsCollapsed}
                      className={cn(
                        "contact-star-button absolute left-0 inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95",
                        detailTabsCollapsed
                          ? "contact-star-glass border-sky-200/70 text-sky-800/80"
                          : "contact-star-active border-blue-900/70 text-white"
                      )}
                      onClick={() => setDetailTabsCollapsed((value) => !value)}
                      type="button"
                    >
                      <Star
                        className={cn(
                          "contact-star-icon size-3.5",
                          !detailTabsCollapsed && "fill-current"
                        )}
                      />
                    </button>
                    <span className="px-10 text-center text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-foreground">
                      Bible Study
                    </span>
                  </div>

                  {!detailTabsCollapsed ? (
                    <motion.div
                      key="studies"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <StudySlotsCard
                        key={studySelection?.focusKey ?? "study-slots"}
                        person={person}
                        activeProfile={activeProfile}
                        configured={configured}
                        onNotice={onNotice}
                        onStudyLogged={onStudyLogged}
                        onStudyDeleted={onStudyDeleted}
                        selectedStudyNumber={studySelection?.studyNumber}
                        embedded
                      />
                    </motion.div>
                  ) : null}
                </section>
                <TimelineTabs
                  events={person.events.filter(
                    (event) => event.event_type !== "study_logged"
                  )}
                  studies={person.studies}
                  profiles={profiles}
                  personId={person.id}
                  activeProfile={activeProfile}
                  configured={configured}
                  onNotice={onNotice}
                  onStudyRenamed={onStudyRenamed}
                  onStudyDeleted={onStudyDeleted}
                  onStudySelected={handleStudyShortcut}
                />
              </div>
            </div>
          </motion.aside>
          {assignmentPopupOpen
            ? createPortal(
                <div
                  aria-modal="true"
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/35 px-4 py-6 backdrop-blur-sm"
                  onClick={() => setAssignmentPopupOpen(false)}
                  role="dialog"
                >
                  <div
                    className="w-full max-w-md"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-3 flex justify-end">
                      <button
                        aria-label="Close assigned profiles"
                        className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                        onClick={() => setAssignmentPopupOpen(false)}
                        type="button"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <section className="soft-panel mb-3 rounded-2xl border p-3">
                      <h3 className="text-center text-[0.7rem] font-black uppercase tracking-[0.26em] text-foreground">
                        Assign new user
                      </h3>
                      <div className="mt-3 grid max-h-36 grid-cols-5 gap-2 overflow-y-auto pr-1">
                        {profiles.map((profile) => {
                          const selected = profile.id === currentAssignmentProfileId;

                          return (
                            <button
                              key={profile.id}
                              type="button"
                              aria-pressed={selected}
                              aria-label={`${selected ? "Current assignee" : "Assign"} ${profile.name}`}
                              title={profile.name}
                              className={cn(
                                "flex aspect-square items-center justify-center rounded-xl border bg-background p-1.5 text-center transition hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                                selected
                                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_oklch(0.22_0.028_264_/_0.22)]"
                                  : "border-foreground/10 opacity-60 saturate-[0.75] hover:opacity-100 hover:saturate-100"
                              )}
                              onClick={() => handleAssignProfile(profile.id)}
                            >
                              <ProfileAvatar profile={profile} size="sm" />
                              <span className="sr-only">
                                {profile.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                    <ProfileAssignmentPicker
                      hideHeader
                      profiles={profiles}
                      selectedIds={assignmentProfileIds}
                      onChange={(ids) => {
                        setSelectedProfileIds(ids);
                        saveContactDetails(detailNotes, ids);
                      }}
                      onProfilesChange={onProfilesChange}
                    />
                    <textarea
                      name="notes"
                      value={detailNotes}
                      onBlur={() => saveContactDetails()}
                      onChange={(event) => {
                        const nextNotes = event.target.value;

                        setDetailNotes(nextNotes);
                        detailDraftRef.current = {
                          ...detailDraftRef.current,
                          notes: nextNotes,
                        };
                      }}
                      rows={4}
                      placeholder="Care notes"
                      className="mt-3 w-full resize-none rounded-xl border border-foreground/10 bg-card px-3 py-2 text-sm leading-5 outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
                    />
                  </div>
                </div>,
                document.body
              )
            : null}
        </>
      ) : null}
    </AnimatePresence>
  );
}

function ContactReactionControls({
  person,
  activeProfile,
  configured,
  disabled,
  onNotice,
  onReactionLogged,
  compact = false,
}: {
  person: BoardPerson;
  activeProfile: BoardProfile | null;
  configured: boolean;
  disabled?: boolean;
  onNotice: (message?: string) => void;
  onReactionLogged: (personId: string, event: PersonEvent) => void;
  compact?: boolean;
}) {
  const [selectedChannel, setSelectedChannel] =
    useState<ContactReactionChannel | null>(null);
  const [compactMenuPosition, setCompactMenuPosition] = useState<{
    right: number;
    top: number;
  } | null>(null);
  const compactControlsRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!compact || !selectedChannel) {
      return;
    }

    function updatePosition() {
      const rect = compactControlsRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setCompactMenuPosition({
        right: Math.max(12, window.innerWidth - rect.right),
        top: Math.max(12, rect.top - 8),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [compact, selectedChannel]);

  function logReaction(
    channel: ContactReactionChannel,
    outcome: ContactReactionOutcome
  ) {
    if (!configured) {
      onNotice("Connect Supabase before logging contact reactions.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before logging contact reactions.");
      return;
    }

    startTransition(async () => {
      const result = await addContactReaction({
        id: person.id,
        channel,
        outcome,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The reaction could not be logged." : result.error);
        return;
      }

      onReactionLogged(person.id, result.data);
      onNotice(undefined);
      setSelectedChannel(null);
      setCompactMenuPosition(null);
    });
  }

  const busy = disabled || isPending;
  const options =
    selectedChannel === "text"
      ? ([
          ["responded", "Replied"],
          ["no_response", "No reply"],
        ] as const)
      : ([
          ["picked_up", "Picked up"],
          ["missed", "Missed"],
        ] as const);

  if (compact) {
    return (
      <div ref={compactControlsRef} className="relative flex shrink-0 items-center gap-1">
        <div className="flex items-center">
          <button
            aria-label="Text reaction"
            className={cn(
              "flex size-7 items-center justify-center text-foreground transition hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
              selectedChannel === "text" && "text-primary"
            )}
            disabled={busy}
            onClick={() =>
              setSelectedChannel((current) => (current === "text" ? null : "text"))
            }
            type="button"
          >
            <MessageCircle className="size-3.5" />
          </button>
          <button
            aria-label="Call reaction"
            className={cn(
              "flex size-7 items-center justify-center border-l border-foreground/15 text-foreground transition hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
              selectedChannel === "call" && "text-primary"
            )}
            disabled={busy}
            onClick={() =>
              setSelectedChannel((current) => (current === "call" ? null : "call"))
            }
            type="button"
          >
            <Phone className="size-3.5" />
          </button>
        </div>
        {selectedChannel && compactMenuPosition
          ? createPortal(
              <div
                className="fixed z-[120] flex -translate-y-full overflow-hidden rounded-full border border-foreground/10 bg-card shadow-[0_18px_45px_-22px_oklch(0.2_0.028_264_/_0.45)]"
                style={{
                  right: compactMenuPosition.right,
                  top: compactMenuPosition.top,
                }}
              >
                {options.map(([outcome, label]) => (
                  <button
                    key={outcome}
                    className="whitespace-nowrap px-3 py-2 text-[0.58rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy}
                    onClick={() => logReaction(selectedChannel, outcome)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>,
              document.body
            )
          : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="flex items-center">
        <button
          aria-label="Text reaction"
          className={cn(
            "flex size-9 items-center justify-center text-foreground transition hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            selectedChannel === "text" && "text-primary"
          )}
          disabled={busy}
          onClick={() =>
            setSelectedChannel((current) => (current === "text" ? null : "text"))
          }
          type="button"
        >
          <MessageCircle className="size-4" />
        </button>
        <button
          aria-label="Call reaction"
          className={cn(
            "flex size-9 items-center justify-center border-l border-foreground/15 text-foreground transition hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            selectedChannel === "call" && "text-primary"
          )}
          disabled={busy}
          onClick={() =>
            setSelectedChannel((current) => (current === "call" ? null : "call"))
          }
          type="button"
        >
          <Phone className="size-4" />
        </button>
      </div>
      {selectedChannel ? (
        <div className="flex overflow-hidden rounded-full border border-foreground/10 bg-background/80">
          {options.map(([outcome, label]) => (
            <button
              key={outcome}
              className="px-3 py-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => logReaction(selectedChannel, outcome)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StudySlotsCard({
  person,
  activeProfile,
  configured,
  onNotice,
  onStudyLogged,
  onStudyDeleted,
  selectedStudyNumber,
  embedded = false,
}: {
  person: BoardPerson;
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onStudyLogged: (
    personId: string,
    study: PersonStudy,
    event: PersonEvent
  ) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
  selectedStudyNumber?: number;
  embedded?: boolean;
}) {
  const pickerInactiveText =
    "text-slate-950/90 [text-shadow:0_1px_1px_rgba(255,255,255,0.85)] hover:text-slate-950 dark:text-foreground/90 dark:hover:text-foreground";
  const pickerInactiveNumber =
    "border-slate-950/35 text-slate-950/95 [text-shadow:0_1px_1px_rgba(255,255,255,0.9)] dark:border-foreground/40 dark:text-foreground";
  const pickerActiveNumber =
    "border-white/90 bg-white/15 text-white drop-shadow-[0_0_9px_rgba(255,255,255,0.95)] shadow-[0_0_18px_rgba(255,255,255,0.55)] [text-shadow:0_1px_7px_rgba(15,23,42,0.55)]";
  const pickerLabelText =
    "text-slate-950/95 [text-shadow:0_1px_1px_rgba(255,255,255,0.85)] dark:text-foreground";
  const pickerActiveLabel =
    "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.95)] [text-shadow:0_1px_7px_rgba(15,23,42,0.55)]";
  const getPickerItemActive = (completed: boolean, pending: boolean) =>
    pending ? !completed : completed;
  const [, startTransition] = useTransition();
  const initialStudyNumber = selectedStudyNumber ?? getNextStudyNumber(person.studies);
  const initialStudy = person.studies.find(
    (study) => study.study_number === initialStudyNumber
  );
  const [logTab, setLogTab] = useState<"bible" | "cm">("bible");
  const [studyPickerOpen, setStudyPickerOpen] = useState<"bible" | "cm" | null>(null);
  const [studyNumber, setStudyNumber] = useState(() =>
    initialStudyNumber
  );
  const initialStudyDate = getDateValue(
    initialStudy?.studied_at ?? sortStudies(person.studies).at(-1)?.studied_at ?? person.created_at
  );
  const [studyDate, setStudyDate] = useState(() => initialStudyDate);
  const [calendarRange, setCalendarRange] = useState(() => ({
    startDate: shiftDateValue(getWeekStartDateValue(initialStudyDate), -28),
    dayCount: 91,
  }));
  const [pendingStudyNumbers, setPendingStudyNumbers] = useState<Set<number>>(
    () => new Set()
  );
  const pendingStudyNumbersRef = useRef<Set<number>>(new Set());
  const calendarStripRef = useRef<HTMLDivElement>(null);
  const isExtendingCalendarRef = useRef(false);
  const pendingCalendarScrollWidthRef = useRef<number | null>(null);
  const completedStudies = sortStudies(person.studies);
  const completedNumbers = new Set(
    completedStudies.map((study) => study.study_number)
  );
  const completedCmNumbers = new Set(
    completedStudies
      .filter((study) => study.study_number > TOTAL_STUDIES)
      .map((study) => study.study_number - TOTAL_STUDIES)
  );
  const calendarWeeks = Array.from(
    { length: Math.ceil(calendarRange.dayCount / WEEKDAY_LABELS.length) },
    (_, weekIndex) =>
      getDateRangeValues(
        shiftDateValue(calendarRange.startDate, weekIndex * WEEKDAY_LABELS.length),
        WEEKDAY_LABELS.length
      )
  );

  function setStudyPending(number: number, pending: boolean) {
    const next = new Set(pendingStudyNumbersRef.current);

    if (pending) {
      next.add(number);
    } else {
      next.delete(number);
    }

    pendingStudyNumbersRef.current = next;
    setPendingStudyNumbers(next);
  }

  function selectCatalogStudy(number: number, title: string) {
    if (pendingStudyNumbersRef.current.has(number)) {
      return;
    }

    const completedStudy = person.studies.find(
      (study) => study.study_number === number
    );

    setStudyNumber(number);

    if (completedStudy) {
      deleteStudy(completedStudy);
    } else {
      saveStudy({
        nextStudyNumber: number,
        nextStudyTitle: title,
      });
    }
  }

  function selectStudy(number: number) {
    selectCatalogStudy(number, getStudyCatalogTitle(number));
  }

  function deleteStudy(study: PersonStudy) {
    if (!configured) {
      onNotice("Connect Supabase before updating studies.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before updating studies.");
      return;
    }

    if (pendingStudyNumbersRef.current.has(study.study_number)) {
      return;
    }

    setStudyPending(study.study_number, true);
    startTransition(async () => {
      const result = await deletePersonStudy({
        id: study.id,
        actorProfileId: activeProfile.id,
      });

      setStudyPending(study.study_number, false);

      if (!result.ok) {
        onNotice(result.error);
        return;
      }

      onNotice(undefined);
      onStudyDeleted(person.id, study.id);
    });
  }

  function getStudyTitleForNumber(number: number) {
    const completedStudy = person.studies.find((study) => study.study_number === number);
    return completedStudy ? getStudyTitle(completedStudy) : getStudyCatalogTitle(number);
  }

  function saveStudy({
    nextStudyNumber = studyNumber,
    nextStudyTitle = getStudyTitleForNumber(nextStudyNumber),
    nextStudiedAt = studyDate,
    nextNotes = "",
  }: {
    nextStudyNumber?: number;
    nextStudyTitle?: string;
    nextStudiedAt?: string;
    nextNotes?: string;
  } = {}) {
    if (!configured) {
      onNotice("Connect Supabase before logging studies.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before logging studies.");
      return;
    }

    if (pendingStudyNumbersRef.current.has(nextStudyNumber)) {
      return;
    }

    setStudyPending(nextStudyNumber, true);
    startTransition(async () => {
      const result = await addPersonStudy({
        id: person.id,
        studyNumber: nextStudyNumber,
        title: nextStudyTitle,
        studiedAt: nextStudiedAt,
        notes: nextNotes,
        actorProfileId: activeProfile.id,
      });

      setStudyPending(nextStudyNumber, false);

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The study could not be saved." : result.error);
        return;
      }

      onNotice(undefined);
      const loggedStudy = result.data.study;
      onStudyLogged(person.id, loggedStudy, result.data.event);
      setStudyNumber(loggedStudy.study_number);
      setStudyDate(getDateValue(loggedStudy.studied_at));
    });
  }

  function selectStudyDate(dateValue: string) {
    setStudyDate(dateValue);
    setCalendarRange((current) => {
      const rangeEndDate = shiftDateValue(current.startDate, current.dayCount - 1);

      if (dateValue >= current.startDate && dateValue <= rangeEndDate) {
        return current;
      }

      return {
        startDate: shiftDateValue(getWeekStartDateValue(dateValue), -28),
        dayCount: 91,
      };
    });
  }

  function handleStudyDateClick(dateValue: string) {
    selectStudyDate(dateValue);
    setStudyPickerOpen(logTab);
  }

  function shiftCalendar(offsetDays: number) {
    selectStudyDate(shiftDateValue(studyDate, offsetDays));
  }

  function handleCalendarScroll(strip: HTMLDivElement) {
    if (isExtendingCalendarRef.current) {
      return;
    }

    const edgeThreshold = 96;

    if (strip.scrollLeft < edgeThreshold) {
      isExtendingCalendarRef.current = true;
      pendingCalendarScrollWidthRef.current = strip.scrollWidth;
      setCalendarRange((current) => ({
        startDate: shiftDateValue(current.startDate, -28),
        dayCount: current.dayCount + 28,
      }));
      return;
    }

    if (strip.scrollLeft + strip.clientWidth > strip.scrollWidth - edgeThreshold) {
      isExtendingCalendarRef.current = true;
      pendingCalendarScrollWidthRef.current = null;
      setCalendarRange((current) => ({
        ...current,
        dayCount: current.dayCount + 28,
      }));
    }
  }

  useEffect(() => {
    const strip = calendarStripRef.current;
    const previousScrollWidth = pendingCalendarScrollWidthRef.current;

    if (!strip || previousScrollWidth === null) {
      isExtendingCalendarRef.current = false;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      strip.scrollLeft += strip.scrollWidth - previousScrollWidth;
      pendingCalendarScrollWidthRef.current = null;
      isExtendingCalendarRef.current = false;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [calendarRange]);

  useEffect(() => {
    const selectedWeek = calendarStripRef.current?.querySelector(
      `[data-week-start="${getWeekStartDateValue(studyDate)}"]`
    );

    selectedWeek?.scrollIntoView({
      block: "nearest",
      inline: "start",
    });
  }, [studyDate]);

  function handleCmSelect(title: string, index: number) {
    const studyNumber = TOTAL_STUDIES + index + 1;
    selectCatalogStudy(studyNumber, `CM: ${title}`);
  }

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col",
        embedded
          ? "border-t border-foreground/[0.07] pt-4"
          : "soft-panel rounded-2xl border p-4"
      )}
    >
      <div className="grid gap-2">
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center">
          <button
            aria-label="Previous study dates"
            className="flex size-7 items-center justify-start text-foreground/65 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            onClick={() => shiftCalendar(-14)}
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-center text-xl font-medium tracking-tight text-foreground/75">
            {formatCalendarTitle(studyDate)}
          </span>
          <button
            aria-label="Next study dates"
            className="flex size-7 items-center justify-end text-foreground/65 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            onClick={() => shiftCalendar(14)}
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          className="-mx-1 flex snap-x snap-mandatory overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => handleCalendarScroll(event.currentTarget)}
          ref={calendarStripRef}
        >
          {calendarWeeks.map((weekDates) => (
            <div
              className="grid min-w-full snap-start grid-cols-7"
              data-week-start={weekDates[0]}
              key={weekDates[0]}
            >
              {weekDates.map((dateValue) => {
                const selected = dateValue === studyDate;
                const hasStudy = completedStudies.some(
                  (study) => getDateValue(study.studied_at) === dateValue
                );
                const date = dateValueToUtcDate(dateValue);
                const day = date.getUTCDate();
                const weekday = WEEKDAY_LABELS[date.getUTCDay()];

                return (
                  <button
                    aria-label={`Select ${formatCalendarTitle(dateValue)}`}
                    className="flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-foreground/65 transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    data-study-date={dateValue}
                    key={dateValue}
                    onClick={() => handleStudyDateClick(dateValue)}
                    type="button"
                  >
                    <span className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-foreground/60">
                      {weekday}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-base font-medium tabular-nums text-foreground/75",
                        selected && "bg-foreground/85 text-background"
                      )}
                    >
                      {day}
                    </span>
                    {hasStudy ? (
                      <span className="block size-1 rounded-full bg-foreground/70" />
                    ) : (
                      <span className="block size-1" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {studyPickerOpen
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm"
              onClick={() => setStudyPickerOpen(null)}
              role="dialog"
            >
              <div
                className="flex max-h-[78vh] w-full max-w-md flex-col overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="relative isolate flex flex-1 gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-y-0 z-0 w-1/2 rounded-full bg-sky-300/55 blur-2xl transition-all duration-300",
                        studyPickerOpen === "cm" ? "left-1/2" : "left-0"
                      )}
                    />
                    {[
                      ["bible", "Bible Study"],
                      ["cm", "CM"],
                    ].map(([value, label]) => (
                      <button
                        aria-pressed={studyPickerOpen === value}
                        className={cn(
                          "relative z-10 flex-1 rounded-full px-3 py-2 text-[0.66rem] font-medium uppercase tracking-[0.16em] transition",
                          studyPickerOpen === value
                            ? "baby-blue-button"
                            : "soft-control text-slate-950 hover:text-sky-800 dark:text-foreground dark:hover:text-sky-200"
                        )}
                        key={value}
                        onClick={() => {
                          const nextTab = value as "bible" | "cm";
                          setLogTab(nextTab);
                          setStudyPickerOpen(nextTab);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    aria-label="Close study picker"
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    onClick={() => setStudyPickerOpen(null)}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="relative min-h-0">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-5 right-5 top-1/2 z-10 h-16 -translate-y-1/2 border-y border-foreground/10"
                  />
                  <div
                    aria-label={studyPickerOpen === "bible" ? "Bible study list" : "CM list"}
                    className="h-[min(58vh,30rem)] snap-y snap-mandatory overflow-y-auto py-24 [mask-image:linear-gradient(to_bottom,transparent,black_17%,black_83%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="listbox"
                  >
                    {studyPickerOpen === "bible"
                      ? STUDY_TITLES.map((title, index) => {
                          const number = index + 1;
                          const completed = completedNumbers.has(number);
                          const pending = pendingStudyNumbers.has(number);
                          const selected = studyNumber === number;
                          const active = getPickerItemActive(completed, pending);

                          return (
                            <button
                              aria-label={`Select ${title}`}
                              aria-selected={selected}
                              className={cn(
                                "flex min-h-16 w-full snap-center items-center gap-3 px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
                                active ? "text-foreground" : pickerInactiveText
                              )}
                              key={title}
                              onClick={() => selectStudy(number)}
                              role="option"
                              type="button"
                            >
                              <span
                                className={cn(
                                  "min-w-7 rounded-full border px-1.5 py-0.5 text-center text-[0.64rem] font-black tabular-nums",
                                  active ? pickerActiveNumber : pickerInactiveNumber
                                )}
                              >
                                {number}
                              </span>
                              <span
                                className={cn(
                                  "min-w-0 flex-1 text-[0.95rem] font-black leading-5",
                                  active ? pickerActiveLabel : pickerLabelText
                                )}
                              >
                                {title}
                              </span>
                            </button>
                          );
                        })
                      : CM_TITLES.map((title, index) => {
                          const number = index + 1;
                          const cmStudyNumber = TOTAL_STUDIES + number;
                          const completed = completedCmNumbers.has(number);
                          const pending = pendingStudyNumbers.has(cmStudyNumber);
                          const selected = studyNumber === cmStudyNumber;
                          const active = getPickerItemActive(completed, pending);

                          return (
                            <button
                              aria-label={`Select ${title}`}
                              aria-selected={selected}
                              className={cn(
                                "flex min-h-16 w-full snap-center items-center gap-3 px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
                                active ? "text-foreground" : pickerInactiveText
                              )}
                              key={title}
                              onClick={() => handleCmSelect(title, index)}
                              role="option"
                              type="button"
                            >
                              <span
                                className={cn(
                                  "min-w-7 rounded-full border px-1.5 py-0.5 text-center text-[0.64rem] font-black tabular-nums",
                                  active ? pickerActiveNumber : pickerInactiveNumber
                                )}
                              >
                                {number}
                              </span>
                              <span
                                className={cn(
                                  "min-w-0 flex-1 text-[0.95rem] font-black leading-5",
                                  active ? pickerActiveLabel : pickerLabelText
                                )}
                              >
                                {title}
                              </span>
                              {completed && !pending ? (
                                <Check className="size-4 shrink-0 stroke-[3] text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.9)]" />
                              ) : null}
                            </button>
                          );
                        })}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

    </section>
  );
}

function TimelineTabs({
  events,
  studies,
  profiles,
  personId,
  activeProfile,
  configured,
  onNotice,
  onStudyRenamed,
  onStudyDeleted,
  onStudySelected,
}: {
  events: PersonEvent[];
  studies: PersonStudy[];
  profiles: BoardProfile[];
  personId: string;
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onStudyRenamed: (personId: string, study: PersonStudy) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
  onStudySelected: (studyNumber: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"activity" | "studies">("activity");
  const [studySearchOpen, setStudySearchOpen] = useState(false);
  const [studySearch, setStudySearch] = useState("");
  const recentStudies = [...sortStudies(studies)].reverse();
  const normalizedStudySearch = studySearch.trim().toLowerCase();
  const filteredStudies = normalizedStudySearch
    ? recentStudies.filter((study) => {
        const actor = profiles.find((profile) => profile.id === study.actor_profile_id);
        const searchableText = [
          getStudyTitle(study),
          study.notes,
          actor?.name,
          formatDate(study.studied_at),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedStudySearch);
      })
    : recentStudies;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] transition",
              activeTab === "activity"
                ? "baby-blue-button"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Activity timeline
            <span className="ml-1.5 opacity-70">{events.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("studies")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] transition",
              activeTab === "studies"
                ? "baby-blue-button"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Study timeline
            <span className="ml-1.5 opacity-70">
              {normalizedStudySearch ? filteredStudies.length : recentStudies.length}
            </span>
          </button>
          <button
            aria-expanded={studySearchOpen}
            aria-label="Search study timeline"
            className={cn(
              "ml-0.5 flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground",
              (studySearchOpen || normalizedStudySearch) && "bg-background text-foreground"
            )}
            onClick={() => {
              setStudySearchOpen((current) => !current);
              setActiveTab("studies");
            }}
            type="button"
          >
            <Search className="size-3.5" />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {studySearchOpen ? (
            <motion.label
              className="soft-inset flex h-9 w-full max-w-56 items-center gap-2 rounded-full border px-3 text-muted-foreground sm:w-56"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "14rem" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <span className="sr-only">Filter study timeline</span>
              <Search className="size-3.5 shrink-0" />
              <input
                autoFocus
                aria-label="Filter study timeline"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                onChange={(event) => setStudySearch(event.target.value)}
                placeholder="Search studies"
                value={studySearch}
              />
              {studySearch ? (
                <button
                  aria-label="Clear study search"
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => setStudySearch("")}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </motion.label>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        {activeTab === "activity" ? (
          <ActivityTimelineList events={events} profiles={profiles} />
        ) : (
          <StudyTimelineList
            studies={filteredStudies}
            profiles={profiles}
            personId={personId}
            activeProfile={activeProfile}
            configured={configured}
            onNotice={onNotice}
            onStudyRenamed={onStudyRenamed}
            onStudyDeleted={onStudyDeleted}
            onStudySelected={onStudySelected}
            emptyMessage={
              normalizedStudySearch
                ? "No studies match that search."
                : "Logged Bible studies will appear here."
            }
          />
        )}
      </div>
    </section>
  );
}

function ActivityTimelineList({
  events,
  profiles,
}: {
  events: PersonEvent[];
  profiles: BoardProfile[];
}) {
  const [visibleTimestampId, setVisibleTimestampId] = useState("");

  if (events.length === 0) {
    return (
      <p className="soft-inset rounded-xl border border-dashed p-4 text-center text-[0.78rem] italic text-muted-foreground">
        Notes, moves, and updates will appear here.
      </p>
    );
  }

  return (
    <div className="relative pl-5">
      <span
        aria-hidden
        className="absolute bottom-2 left-[9px] top-2 w-px bg-foreground/10"
      />
      <ul className="space-y-3">
        {events.map((event) => {
          const actor = profiles.find(
            (profile) => profile.id === event.actor_profile_id
          );
          return (
            <li key={event.id} className="relative">
              <button
                aria-label={`Show date and time for ${displayStageCopy(event.title)}`}
                aria-pressed={visibleTimestampId === event.id}
                className={cn(
                  "absolute -left-[16px] z-10 size-3 rounded-full border-2 border-card bg-foreground/70 transition hover:scale-125 hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                  visibleTimestampId === event.id ? "top-[1.15rem]" : "top-2.5"
                )}
                onClick={() =>
                  setVisibleTimestampId((current) =>
                    current === event.id ? "" : event.id
                  )
                }
                type="button"
              />
              <div className="soft-control rounded-xl border p-3">
                {visibleTimestampId === event.id ? (
                  <p className="mb-2 rounded-full bg-background px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </p>
                ) : null}
                <div className="flex items-center gap-2.5">
                  <ProfileAvatar profile={actor ?? null} size="xs" />
                  <div className="min-w-0 flex-1">
                    {event.body ? (
                      <p className="border-l-2 border-foreground/10 pl-3 text-[0.78rem] leading-5 text-muted-foreground">
                        {displayStageCopy(event.body)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StudyTimelineList({
  studies,
  profiles,
  personId,
  activeProfile,
  configured,
  onNotice,
  onStudyRenamed,
  onStudyDeleted,
  onStudySelected,
  emptyMessage = "Logged Bible studies will appear here.",
}: {
  studies: PersonStudy[];
  profiles: BoardProfile[];
  personId: string;
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onStudyRenamed: (personId: string, study: PersonStudy) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
  onStudySelected: (studyNumber: number) => void;
  emptyMessage?: string;
}) {
  if (studies.length === 0) {
    return (
      <p className="soft-inset rounded-xl border border-dashed p-4 text-center text-[0.78rem] italic text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="relative pl-5">
      <span
        aria-hidden
        className="absolute bottom-2 left-[9px] top-2 w-px bg-foreground/10"
      />
      <ul className="space-y-3">
        {studies.map((study, index) => {
          const actor = profiles.find(
            (profile) => profile.id === study.actor_profile_id
          );
          const displayNumber = studies.length - index;

          return (
            <StudyTimelineItem
              key={study.id}
              study={study}
              displayNumber={displayNumber}
              actor={actor ?? null}
              personId={personId}
              activeProfile={activeProfile}
              configured={configured}
              onNotice={onNotice}
              onStudyRenamed={onStudyRenamed}
              onStudyDeleted={onStudyDeleted}
              onStudySelected={onStudySelected}
            />
          );
        })}
      </ul>
    </div>
  );
}

function StudyTimelineItem({
  study,
  displayNumber,
  actor,
  personId,
  activeProfile,
  configured,
  onNotice,
  onStudyRenamed,
  onStudyDeleted,
  onStudySelected,
}: {
  study: PersonStudy;
  displayNumber: number;
  actor: BoardProfile | null;
  personId: string;
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onStudyRenamed: (personId: string, study: PersonStudy) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
  onStudySelected: (studyNumber: number) => void;
}) {
  const [notePopupOpen, setNotePopupOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(study.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timestampVisible, setTimestampVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const notePopupId = useId();
  const noteInputId = useId();
  const studyTitle = getStudyTitle(study);
  const savedNote = study.notes?.trim() ?? "";
  const hasStudyNote = Boolean(savedNote);

  function requireStudyAction() {
    if (!configured) {
      onNotice("Connect Supabase before editing studies.");
      return false;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before editing studies.");
      return false;
    }

    return true;
  }

  function openNotePopup() {
    if (!requireStudyAction()) {
      return;
    }

    setConfirmDelete(false);
    setNoteDraft(study.notes ?? "");
    setNotePopupOpen(true);
  }

  function closeNotePopup() {
    setNoteDraft(study.notes ?? "");
    setNotePopupOpen(false);
  }

  function handleSaveNote(formData: FormData) {
    if (!requireStudyAction() || !activeProfile) {
      return;
    }

    const nextNote = String(formData.get("notes") ?? "").trim();

    if (nextNote === savedNote) {
      onNotice(undefined);
      setNotePopupOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await updatePersonStudyNote({
        id: study.id,
        notes: nextNote,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The study note could not be saved." : result.error);
        return;
      }

      onNotice(undefined);
      onStudyRenamed(personId, result.data);
      setNoteDraft(result.data.notes ?? "");
      setNotePopupOpen(false);
    });
  }

  function handleDelete() {
    setNotePopupOpen(false);
    setConfirmDelete(true);
  }

  function handleConfirmDelete() {
    if (!requireStudyAction() || !activeProfile) {
      return;
    }

    startTransition(async () => {
      const result = await deletePersonStudy({
        id: study.id,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok) {
        onNotice(result.error);
        return;
      }

      onNotice(undefined);
      onStudyDeleted(personId, study.id);
    });
  }

  return (
    <li className="relative">
      <button
        aria-label={`Show date and time for ${studyTitle}`}
        aria-pressed={timestampVisible}
        className={cn(
          "absolute -left-[17px] z-10 flex size-4 items-center justify-center rounded-full border border-card bg-foreground text-[0.52rem] font-medium text-background transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
          timestampVisible ? "top-4" : "top-2"
        )}
        onClick={() => setTimestampVisible((value) => !value)}
        type="button"
      >
        {displayNumber}
      </button>
      <div className="soft-control rounded-xl border p-3">
        {timestampVisible ? (
          <p className="mb-2 rounded-full bg-background px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Logged {formatDateTime(study.created_at)}
          </p>
        ) : null}
        <div className="flex items-start gap-2.5">
          <ProfileAvatar profile={actor} size="xs" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                aria-label={`Open ${studyTitle}`}
                className="min-w-0 truncate text-left text-[0.85rem] font-medium tracking-tight text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                onClick={() => onStudySelected(study.study_number)}
                type="button"
              >
                {studyTitle}
              </button>
              <div className="relative shrink-0">
                <button
                  aria-controls={notePopupOpen ? notePopupId : undefined}
                  aria-expanded={notePopupOpen}
                  aria-haspopup="dialog"
                  aria-label={`${hasStudyNote ? "Edit" : "Add"} quick note for ${studyTitle}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                  disabled={isPending}
                  onClick={openNotePopup}
                  type="button"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
              {notePopupOpen
                ? createPortal(
                    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-6 sm:px-6">
                      <button
                        aria-label="Close quick note"
                        className="absolute inset-0 cursor-default bg-foreground/10 backdrop-blur-[1px]"
                        disabled={isPending}
                        onClick={closeNotePopup}
                        type="button"
                      />
                      <motion.div
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/75 bg-white/90 p-3 text-foreground shadow-[0_24px_70px_-28px_oklch(0.2_0.028_264_/_0.55)] backdrop-blur-xl dark:border-foreground/10 dark:bg-card/95 sm:p-4"
                        id={notePopupId}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        role="dialog"
                        aria-modal="true"
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        <form
                          action={handleSaveNote}
                          className="space-y-2"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              closeNotePopup();
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label
                              className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-sky-700"
                              htmlFor={noteInputId}
                            >
                              Quick note
                            </label>
                            <button
                              aria-label="Close quick note"
                              className="rounded-full p-1 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                              disabled={isPending}
                              onClick={closeNotePopup}
                              type="button"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <textarea
                            autoFocus
                            className="soft-inset min-h-20 w-full resize-none rounded-xl border px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/20"
                            id={noteInputId}
                            name="notes"
                            onChange={(event) => setNoteDraft(event.target.value)}
                            placeholder="Add a quick note for this study..."
                            rows={3}
                            value={noteDraft}
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[0.64rem] font-medium text-muted-foreground">
                              Shows under the title.
                            </span>
                            <div className="flex gap-1.5">
                              <Button
                                className="h-7 px-2.5 text-[0.68rem]"
                                disabled={isPending}
                                onClick={closeNotePopup}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                Cancel
                              </Button>
                              <Button
                                className="h-7 px-3 text-[0.68rem]"
                                disabled={isPending}
                                size="sm"
                                type="submit"
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        </form>
                      </motion.div>
                    </div>,
                    document.body
                  )
                : null}
            </div>
            {hasStudyNote ? (
              <button
                aria-label={`Open ${studyTitle}`}
                className="mt-2 block w-full border-l-2 border-foreground/10 pl-3 text-left text-[0.78rem] leading-5 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                onClick={() => onStudySelected(study.study_number)}
                type="button"
              >
                {savedNote}
              </button>
            ) : null}
          </div>
          <div className="relative shrink-0">
            <button
              aria-label={`Delete ${studyTitle}`}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-700"
              disabled={isPending}
              onClick={handleDelete}
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
            <AnimatePresence>
              {confirmDelete ? (
                <motion.div
                  className="absolute right-0 top-8 z-10 w-40 rounded-xl border border-red-500/20 bg-card p-2 shadow-[0_18px_45px_-22px_oklch(0.2_0.028_264_/_0.45)]"
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="px-1 text-[0.68rem] font-medium text-foreground">
                    Delete this study?
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      disabled={isPending}
                      onClick={() => setConfirmDelete(false)}
                      size="sm"
                      type="button"
                      variant="ghost"
                      className="h-7 flex-1 px-2 text-[0.68rem]"
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={handleConfirmDelete}
                      size="sm"
                      type="button"
                      className="h-7 flex-1 bg-red-700 px-2 text-[0.68rem] text-white hover:bg-red-800"
                    >
                      Delete
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </li>
  );
}

function ContactAvatar({
  person,
  size = "md",
}: {
  person: BoardPerson | null;
  size?: "xs" | "md" | "lg" | "row";
}) {
  const sizeClass = {
    xs: "size-4 text-[0.52rem]",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
    row: "size-11 text-base",
  }[size];
  const rowAvatar = size === "row";
  const tinyAvatar = size === "xs";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden font-display tracking-display",
        rowAvatar ? "rounded-[22%]" : "rounded-full",
        tinyAvatar ? "contact-avatar-flat" : "contact-avatar-neu",
        sizeClass
      )}
      title={person?.name ?? "Contact photo"}
    >
      {person?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          draggable={false}
          src={person.avatar_url}
        />
      ) : (
        person?.name.slice(0, 1).toUpperCase() ?? "·"
      )}
    </span>
  );
}

function ContactAvatarSlot({ person }: { person: BoardPerson | null }) {
  return (
    <span className="flex w-[3.25rem] shrink-0 justify-center">
      <ContactAvatar person={person} size="row" />
    </span>
  );
}

function ProfileAvatar({
  live = false,
  profile,
  size = "md",
}: {
  live?: boolean;
  profile: BoardProfile | null;
  size?: "xs" | "sm" | "md" | "lg" | "icon";
}) {
  const sizeClass = {
    xs: "size-6",
    icon: "size-7",
    sm: "size-9",
    md: "size-10",
    lg: "size-[3.25rem]",
  }[size];

  return (
    <span
      className={cn(
        "profile-avatar-shell",
        live &&
          "profile-avatar-live ring-2 ring-white/90",
        sizeClass
      )}
      title={profile ? (live ? `${profile.name} is live` : profile.name) : "No profile"}
    >
      <span className="profile-avatar-inner">
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="profile-avatar-photo"
          draggable={false}
          src={profile.avatar_url}
          style={{
            objectPosition: `${profile.avatar_offset_x ?? 50}% ${profile.avatar_offset_y ?? 50}%`,
            transform: `scale(${profile.avatar_scale ?? 1})`,
            transformOrigin: "center",
          }}
        />
      ) : (
        <svg
          aria-hidden="true"
          className="profile-avatar-glyph"
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="33" r="17" />
          <path d="M20 80c2-20 15-34 30-34s28 14 30 34c.6 6-3.5 10-9.5 10h-41C23.5 90 19.4 86 20 80Z" />
        </svg>
      )}
        <span className="profile-avatar-gloss" />
      </span>
    </span>
  );
}

function fileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Choose an image file."));
  }

  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("Photo must be under 5 MB."));
  }

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const outputSize = 192;
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
      const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Could not prepare photo."));
        return;
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read photo."));
    };

    image.src = objectUrl;
  });
}

function ProfileStack({
  profiles,
  className,
}: {
  profiles: BoardProfile[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex -space-x-1.5">
        {profiles.slice(0, 3).map((profile) => (
          <ProfileAvatar key={profile.id} profile={profile} size="xs" />
        ))}
      </div>
      <span className="min-w-0 truncate text-[0.72rem] text-muted-foreground">
        {profiles.length > 0
          ? profiles.map((profile) => profile.name).join(", ")
          : "No profiles assigned"}
      </span>
    </div>
  );
}

function ProfileAssignmentPicker({
  hideHeader = false,
  highContrastText = false,
  profiles,
  selectedIds,
  onChange,
  onProfilesChange,
  shape = "soft",
}: {
  hideHeader?: boolean;
  highContrastText?: boolean;
  profiles: BoardProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  shape?: "soft" | "square";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customError, setCustomError] = useState("");
  const [deleteOptionProfileId, setDeleteOptionProfileId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isCreatingCustom, startCustomTransition] = useTransition();
  const [isDeletingProfile, startDeleteTransition] = useTransition();
  const deleteRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedProfiles = selectedIds
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter(Boolean) as BoardProfile[];
  const visibleProfiles = profiles.filter((profile) =>
    profile.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const isSquare = shape === "square";

  useEffect(() => {
    return () => {
      if (deleteRevealTimerRef.current) {
        clearTimeout(deleteRevealTimerRef.current);
      }
    };
  }, []);

  function toggle(profileId: string) {
    const selected = selectedIds.includes(profileId);
    setDeleteOptionProfileId("");
    setDeleteError("");

    if (selected) {
      removeProfile(profileId);
      return;
    }

    if (selectedIds.length >= 3) {
      return;
    }

    onChange([...selectedIds, profileId]);
  }

  function removeProfile(profileId: string) {
    if (selectedIds.length === 1) {
      return;
    }

    onChange(selectedIds.filter((id) => id !== profileId));
  }

  function cancelDeleteReveal() {
    if (deleteRevealTimerRef.current) {
      clearTimeout(deleteRevealTimerRef.current);
      deleteRevealTimerRef.current = null;
    }
  }

  function startDeleteReveal(profileId: string) {
    cancelDeleteReveal();
    setDeleteError("");
    deleteRevealTimerRef.current = setTimeout(() => {
      setDeleteOptionProfileId(profileId);
      deleteRevealTimerRef.current = null;
    }, 3000);
  }

  function handleDeleteProfile(profile: BoardProfile) {
    setDeleteError("");

    if (selectedIds.includes(profile.id) && selectedIds.length === 1) {
      setDeleteError("Add another branch before deleting this one.");
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteProfile(profile.id);

      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }

      onProfilesChange(profiles.filter((item) => item.id !== profile.id));
      onChange(selectedIds.filter((id) => id !== profile.id));
      setDeleteOptionProfileId("");
    });
  }

  function handleCreateCustom() {
    const name = customName.trim();

    setCustomError("");

    if (!name) {
      setCustomError("Add a name for the custom person.");
      return;
    }

    if (selectedIds.length >= 3) {
      setCustomError("Remove one profile before adding a custom person.");
      return;
    }

    startCustomTransition(async () => {
      const result = await createProfile(name);

      if (!result.ok || !result.data) {
        setCustomError(result.ok ? "Could not add custom person." : result.error);
        return;
      }

      const nextProfiles = [...profiles, result.data].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      onProfilesChange(nextProfiles);
      onChange([...selectedIds, result.data.id]);
      setCustomName("");
      setCustomOpen(false);
    });
  }

  return (
    <div
      className={cn(
        "soft-panel border p-2.5",
        highContrastText && "text-slate-950 dark:text-foreground",
        isSquare ? "rounded-md" : "rounded-xl"
      )}
    >
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => {
          const profile = selectedProfiles[index] ?? null;

          return (
            <div
              key={profile?.id ?? `empty-${index}`}
              className={cn(
                "soft-control relative min-h-[4.5rem] border text-center transition hover:cyan-accent",
                isSquare ? "rounded-md" : "rounded-xl",
                profile && "soft-inset"
              )}
            >
              {profile ? (
                <>
                  {selectedProfiles.length > 1 ? (
                    <button
                      aria-label={`Remove ${profile.name}`}
                      className={cn(
                        "soft-control absolute right-1.5 top-1.5 z-10 inline-flex size-5 items-center justify-center border text-foreground/55 transition hover:border-destructive/30 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                        isSquare ? "rounded-md" : "rounded-full"
                      )}
                      onClick={() => removeProfile(profile.id)}
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                  <button
                    className="flex min-h-[4.5rem] w-full flex-col items-center justify-center px-2 py-2"
                    onClick={() => setOpen(true)}
                    type="button"
                  >
                    <ProfileAvatar profile={profile} size="sm" />
                    <span
                      className={cn(
                        "mt-1.5 max-w-full truncate text-[0.72rem] font-medium tracking-tight",
                        highContrastText
                          ? "text-slate-950 dark:text-foreground"
                          : "text-foreground"
                      )}
                    >
                      {profile.name}
                    </span>
                  </button>
                </>
              ) : (
                <button
                  className="flex min-h-[4.5rem] w-full flex-col items-center justify-center px-2 py-2"
                  onClick={() => setOpen(true)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center border border-dashed border-foreground/20",
                      highContrastText
                        ? "text-slate-800 dark:text-muted-foreground"
                        : "text-muted-foreground",
                      isSquare ? "rounded-md" : "rounded-full"
                    )}
                  >
                    <Plus className="size-3.5" />
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em]",
                      highContrastText
                        ? "text-slate-900/80 dark:text-muted-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    Branch {index + 1}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
            <motion.button
              aria-label="Close assignment picker"
              className="absolute inset-0 bg-foreground/45 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              type="button"
            />
            <motion.div
              className={cn(
                "relative z-10 flex max-h-[86vh] w-full max-w-lg flex-col border bg-card p-4 shadow-2xl",
                isSquare ? "rounded-md" : "rounded-t-[2rem] sm:rounded-[2rem]"
              )}
              initial={{ opacity: 0, y: 72, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 72, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Assign profiles"
            >
              <div className="flex items-start justify-between gap-4">
                {!hideHeader ? (
                  <div>
                    <h3 className="flex flex-wrap items-baseline gap-3 font-display text-3xl leading-[0.95] tracking-display">
                      <span>Branches</span>
                      <span className="text-3xl text-muted-foreground">
                        {selectedIds.length} of 3
                      </span>
                    </h3>
                  </div>
                ) : (
                  <span className="sr-only">{selectedIds.length} of 3 selected</span>
                )}
                <Button
                  onClick={() => setOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-5" />
                </Button>
              </div>

              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <span className="sr-only">Search profiles</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search profiles"
                  className={cn(
                    "h-11 w-full border bg-background pl-11 pr-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                    isSquare ? "rounded-md" : "rounded-2xl"
                  )}
                />
              </label>

              {customOpen ? (
                <form
                  action={handleCreateCustom}
                  className={cn(
                    "mt-3 border border-foreground/10 bg-background p-3",
                    isSquare ? "rounded-md" : "rounded-2xl"
                  )}
                >
                  <label className="block">
                    <span className="sr-only">Custom person name</span>
                    <input
                      autoFocus
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                      placeholder="Custom person name"
                      className={cn(
                        "h-10 w-full border bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                        isSquare ? "rounded-md" : "rounded-xl"
                      )}
                    />
                  </label>
                  {customError ? (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      {customError}
                    </p>
                  ) : null}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      disabled={isCreatingCustom}
                      onClick={() => {
                        setCustomOpen(false);
                        setCustomError("");
                        setCustomName("");
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                    <Button disabled={isCreatingCustom} size="sm" type="submit">
                      Add
                    </Button>
                  </div>
                </form>
              ) : null}
              {deleteError ? (
                <p
                  className={cn(
                    "mt-3 border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive",
                    isSquare ? "rounded-md" : "rounded-2xl"
                  )}
                >
                  {deleteError}
                </p>
              ) : null}

              {hideHeader ? (
                <div className="mt-3 flex items-end justify-between px-1">
                  <h3 className="font-display text-2xl leading-none tracking-display text-foreground">
                    Branches
                  </h3>
                  <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {selectedIds.length} of 3
                  </span>
                </div>
              ) : null}

              <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-y-auto pr-1">
                <button
                  aria-label="Add custom person"
                  className={cn(
                    "flex aspect-square items-center justify-center border border-dashed border-foreground/20 bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-45",
                    isSquare ? "rounded-md" : "rounded-2xl"
                  )}
                  disabled={selectedIds.length >= 3}
                  onClick={() => {
                    setCustomOpen(true);
                    setCustomError("");
                  }}
                  title="Custom"
                  type="button"
                >
                  <span className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex size-10 items-center justify-center border border-foreground/15",
                        isSquare ? "rounded-md" : "rounded-full"
                      )}
                    >
                      <Plus className="size-4" />
                    </span>
                    <span className="text-[0.58rem] font-black uppercase tracking-[0.14em]">
                      Custom
                    </span>
                  </span>
                </button>
                {visibleProfiles.length > 0 ? (
                  visibleProfiles.map((profile) => {
                    const selected = selectedIds.includes(profile.id);
                    const disabled = !selected && selectedIds.length >= 3;

                    return (
                      <div key={profile.id} className="relative aspect-square">
                        <button
                          aria-label={`${selected ? "Remove" : "Assign"} ${profile.name}`}
                          title={`${profile.name}. Hold for 3 seconds to show delete.`}
                          className={cn(
                            "flex size-full flex-col items-center justify-center gap-2 border bg-background px-1.5 transition hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                            isSquare ? "rounded-md" : "rounded-2xl",
                            selected && "border-primary bg-primary/10 shadow-[0_0_0_1px_oklch(0.22_0.028_264_/_0.22)]",
                            disabled && "cursor-not-allowed opacity-45"
                          )}
                          disabled={disabled || isDeletingProfile}
                          onClick={(event) => {
                            if (deleteOptionProfileId === profile.id) {
                              event.preventDefault();
                              return;
                            }

                            toggle(profile.id);
                          }}
                          onContextMenu={(event) => event.preventDefault()}
                          onPointerCancel={cancelDeleteReveal}
                          onPointerDown={() => startDeleteReveal(profile.id)}
                          onPointerLeave={cancelDeleteReveal}
                          onPointerUp={cancelDeleteReveal}
                          type="button"
                        >
                          <ProfileAvatar profile={profile} size="md" />
                          <span className="max-w-full truncate text-[0.72rem] font-medium tracking-tight text-foreground">
                            {profile.name}
                          </span>
                        </button>
                        {deleteOptionProfileId === profile.id ? (
                          <button
                            aria-label={`Delete ${profile.name}`}
                            className={cn(
                              "absolute inset-x-2 bottom-2 bg-destructive px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-white shadow-lg transition hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60",
                              isSquare ? "rounded-md" : "rounded-full"
                            )}
                            disabled={isDeletingProfile}
                            onClick={() => handleDeleteProfile(profile)}
                            type="button"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p
                    className={cn(
                      "col-span-4 border border-dashed bg-background p-4 text-center text-sm text-muted-foreground",
                      isSquare ? "rounded-md" : "rounded-2xl"
                    )}
                  >
                    No profiles match that search.
                  </p>
                )}
              </div>

              <Button
                className={cn("mt-4 w-full", isSquare && "rounded-md")}
                disabled={selectedIds.length < 1}
                onClick={() => setOpen(false)}
                type="button"
              >
                Done
              </Button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
