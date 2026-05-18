"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ChangeEvent,
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
  Briefcase,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Pencil,
  Plus,
  Search,
  School,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from "lucide-react";

import {
  addContactReaction,
  addPersonStudy,
  createPerson,
  createProfile,
  deletePersonStudy,
  deleteProfile,
  movePerson,
  updatePersonAvatar,
  updatePersonStudyTitle,
  updatePerson,
  type BoardProfile,
  type BoardPerson,
  type ContactReactionChannel,
  type ContactReactionOutcome,
  type PersonEvent,
  type PersonLifeStatus,
  type PersonStudy,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ProfileSheet } from "@/components/profiles/profile-sheet";
import {
  getActiveProfileId,
  getActiveProfileServerSnapshot,
  onActiveProfileChange,
  setActiveProfileId,
} from "@/lib/profiles-client";
import { cn } from "@/lib/utils";
import { isStageId, STAGES, type StageId } from "@/lib/stages";

type BoardProps = {
  initialPeople: BoardPerson[];
  initialProfiles: BoardProfile[];
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

const stageTones: Record<StageId, StageTone> = {
  hunting: {
    text: "text-sky-700",
    soft: "soft-control text-sky-700",
    ring: "ring-sky-300/60",
    dot: "bg-sky-400",
    card: "from-sky-100/55 via-white/30 to-transparent",
    edge: "via-sky-300/55",
    glow: "from-sky-100/60 via-white/0 to-transparent",
  },
  first_bible_study: {
    text: "text-blue-700",
    soft: "soft-control text-blue-700",
    ring: "ring-blue-300/60",
    dot: "bg-blue-400",
    card: "from-blue-100/50 via-white/30 to-transparent",
    edge: "via-blue-300/50",
    glow: "from-blue-100/55 via-white/0 to-transparent",
  },
  third_bible_study: {
    text: "text-cyan-700",
    soft: "soft-control text-cyan-700",
    ring: "ring-cyan-300/60",
    dot: "bg-cyan-400",
    card: "from-cyan-100/50 via-white/30 to-transparent",
    edge: "via-cyan-300/50",
    glow: "from-cyan-100/55 via-white/0 to-transparent",
  },
  seventh_bible_study: {
    text: "text-sky-800",
    soft: "soft-control text-sky-800",
    ring: "ring-sky-300/60",
    dot: "bg-sky-500",
    card: "from-sky-100/45 via-white/30 to-transparent",
    edge: "via-sky-300/50",
    glow: "from-sky-100/55 via-white/0 to-transparent",
  },
  ready_for_baptism: {
    text: "text-blue-800",
    soft: "soft-control text-blue-800",
    ring: "ring-blue-300/60",
    dot: "bg-blue-500",
    card: "from-blue-100/45 via-white/30 to-transparent",
    edge: "via-blue-300/50",
    glow: "from-blue-100/55 via-white/0 to-transparent",
  },
  baptized: {
    text: "text-cyan-800",
    soft: "soft-control text-cyan-800",
    ring: "ring-cyan-300/60",
    dot: "bg-cyan-500",
    card: "from-cyan-100/45 via-white/30 to-transparent",
    edge: "via-cyan-300/50",
    glow: "from-cyan-100/55 via-white/0 to-transparent",
  },
};

const emptyMessages: Record<StageId, string> = {
  hunting: "Sow the first seed with prayer, care, or an invitation.",
  first_bible_study: "Schedule the first open-Bible conversation.",
  third_bible_study: "Move consistent early studies here.",
  seventh_bible_study: "Track steady studies that need continued care.",
  ready_for_baptism: "Keep final preparation visible and personal.",
  baptized: "This month’s baptisms will glow here.",
};

const stageIndex: Record<StageId, string> = {
  hunting: "01",
  first_bible_study: "02",
  third_bible_study: "03",
  seventh_bible_study: "04",
  ready_for_baptism: "05",
  baptized: "06",
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
    ...person.events.map((event) => ({
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

function displayStageCopy(value: string) {
  return value.replaceAll("Hunting", "Sowing Seeds");
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

function getNextStage(stage: StageId, direction: -1 | 1) {
  const index = STAGES.findIndex((item) => item.id === stage);
  const next = STAGES[index + direction];

  return next?.id;
}

export function BibleStudyBoard({
  initialPeople,
  initialProfiles,
  configured,
  error,
}: BoardProps) {
  const [mounted, setMounted] = useState(false);
  const [people, setPeople] = useState(initialPeople);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState(error);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingProfileSwitchId, setPendingProfileSwitchId] = useState<string | null>(null);
  const activeProfileId = useSyncExternalStore(
    onActiveProfileChange,
    getActiveProfileId,
    getActiveProfileServerSnapshot
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));

    return () => window.cancelAnimationFrame(frame);
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
    const query = search.trim().toLowerCase();
    const activeFilterId =
      profileFilter === "mine" ? activeProfileId : profileFilter === "all" ? "" : profileFilter;
    const profileFilteredPeople = activeFilterId
      ? people.filter((person) => person.assigned_profile_ids.includes(activeFilterId))
      : people;

    if (!query) {
      return profileFilteredPeople;
    }

    return profileFilteredPeople.filter((person) =>
      [
        person.name,
        person.phone,
        person.teacher,
        person.notes,
        profileNames(person, profiles),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [activeProfileId, people, profileFilter, profiles, search]);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const requireProfile = configured && !activeProfile;
  const activePerson = activeId
    ? people.find((person) => person.id === activeId) ?? null
    : null;
  const selectedPerson = selectedId
    ? people.find((person) => person.id === selectedId) ?? null
    : null;
  const pendingProfileSwitch = pendingProfileSwitchId
    ? profiles.find((profile) => profile.id === pendingProfileSwitchId) ?? null
    : null;

  function requireActiveProfile() {
    if (!activeProfile) {
      setProfileSheetOpen(true);
      setNotice("Choose your profile before making changes.");
      return null;
    }

    return activeProfile.id;
  }

  function handleSelectProfile(profileId: string) {
    if (activeProfileId && profileId !== activeProfileId) {
      setPendingProfileSwitchId(profileId);
      setProfileSheetOpen(false);
      return;
    }

    confirmProfileSwitch(profileId);
  }

  function confirmProfileSwitch(profileId: string) {
    setActiveProfileId(profileId);
    setProfileSheetOpen(false);
    setPendingProfileSwitchId(null);
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
    const targetStage = isStageId(overId) ? overId : overPerson?.stage;

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
          ? { ...person, events: item.events, studies: item.studies }
          : item
      )
    );
  }

  function handleStudyLogged(
    personId: string,
    study: PersonStudy,
    event: PersonEvent
  ) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              studies: sortStudies([
                ...person.studies.filter(
                  (item) => item.study_number !== study.study_number
                ),
                study,
              ]),
              events: [event, ...person.events],
            }
          : person
      )
    );
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
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? {
              ...person,
              studies: person.studies.filter((study) => study.id !== studyId),
            }
          : person
      )
    );
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

  if (!mounted) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground grain">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(70rem_44rem_at_18%_-10%,oklch(1_0_0_/_0.92),transparent_58%),radial-gradient(54rem_38rem_at_95%_8%,oklch(0.82_0.105_244_/_0.2),transparent_58%),radial-gradient(48rem_38rem_at_8%_105%,oklch(0.86_0.06_210_/_0.24),transparent_62%),linear-gradient(145deg,oklch(0.985_0.004_215)_0%,var(--background)_46%,oklch(0.91_0.018_215)_100%)]"
        />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground grain">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(70rem_44rem_at_18%_-10%,oklch(1_0_0_/_0.92),transparent_58%),radial-gradient(54rem_38rem_at_95%_8%,oklch(0.82_0.105_244_/_0.2),transparent_58%),radial-gradient(48rem_38rem_at_8%_105%,oklch(0.86_0.06_210_/_0.24),transparent_62%),linear-gradient(145deg,oklch(0.985_0.004_215)_0%,var(--background)_46%,oklch(0.91_0.018_215)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,oklch(0.76_0.13_244_/_0.28),transparent)]"
      />
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
          onAddContact={() => setQuickAddOpen(true)}
          graphPeople={filteredPeople}
          graphProfiles={profiles}
          configured={configured}
          notice={notice}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <JourneyBoard
            people={filteredPeople}
            profiles={profiles}
            activeProfile={activeProfile}
            configured={configured}
            isPending={isPending}
            onMove={moveWithButtons}
            onNotice={setNotice}
            onSelect={setSelectedId}
            onReactionLogged={handleReactionLogged}
          />

          <DragOverlay>
            {activePerson ? (
              <CardPreview person={activePerson} profiles={profiles} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <PersonDetailPanel
        key={selectedPerson?.id ?? "empty"}
        person={selectedPerson}
        profiles={profiles}
        activeProfile={activeProfile}
        configured={configured}
        onClose={() => setSelectedId(null)}
        onUpdated={handleUpdated}
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
      <AnimatePresence>
        {pendingProfileSwitch ? (
          <motion.div
            aria-modal="true"
            className="fixed inset-0 z-[130] flex items-center justify-center bg-foreground/25 px-4 py-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
          >
            <motion.div
              className="soft-panel-strong w-full max-w-xs rounded-[1.5rem] border p-5 text-center"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="mx-auto mb-3 flex justify-center">
                <ProfileAvatar profile={pendingProfileSwitch} size="md" />
              </div>
              <h2 className="font-display text-2xl leading-none tracking-display text-foreground">
                Switch profile?
              </h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                Do you want to switch to {pendingProfileSwitch.name}?
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button
                  className="h-10 rounded-full"
                  onClick={() => setPendingProfileSwitchId(null)}
                  type="button"
                  variant="outline"
                >
                  No
                </Button>
                <Button
                  className="baby-blue-button h-10 rounded-full"
                  onClick={() => confirmProfileSwitch(pendingProfileSwitch.id)}
                  type="button"
                >
                  Yes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
  onAddContact,
  graphPeople,
  graphProfiles,
  configured,
  notice,
}: {
  search: string;
  onSearch: (value: string) => void;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  profileFilter: string;
  onProfileFilterChange: (value: string) => void;
  onOpenProfiles: () => void;
  onSelectProfile: (profileId: string) => void;
  onAddContact: () => void;
  graphPeople: BoardPerson[];
  graphProfiles: BoardProfile[];
  configured: boolean;
  notice?: string;
}) {
  const [openControl, setOpenControl] = useState<"search" | "filter" | "followup" | null>(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const [settingsMode, setSettingsMode] = useState<"closed" | "menu" | "graphs">("closed");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastProfileWheelAtRef = useRef(0);
  const lastRailToggleAtRef = useRef(0);
  const otherProfiles = profiles.filter((profile) => profile.id !== activeProfile?.id);
  const activeFilterLabel =
    profileFilter === "mine"
      ? "My contacts"
      : profileFilter === "all"
        ? "All contacts"
        : profiles.find((profile) => profile.id === profileFilter)?.name ?? "All contacts";
  const followUpItems = graphPeople
    .map((person) => {
      const latestActivity = getLatestActivitySnapshot(person);
      const daysQuiet = daysSinceDate(latestActivity.value);
      const assignedProfiles = getAssignedProfiles(person, profiles);
      const ownerLabel =
        assignedProfiles.length > 0
          ? assignedProfiles.map((profile) => profile.name).join(", ")
          : person.teacher || "Unassigned";

      return {
        person,
        daysQuiet,
        latestActivity,
        ownerLabel,
        stageLabel: STAGES.find((stage) => stage.id === person.stage)?.label ?? person.stage,
      };
    })
    .filter((item) => item.daysQuiet >= 5)
    .sort((a, b) => b.daysQuiet - a.daysQuiet);

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

    const activeIndex = activeProfile
      ? profiles.findIndex((profile) => profile.id === activeProfile.id)
      : -1;
    const direction = horizontalDelta > 0 ? 1 : -1;
    const nextIndex =
      activeIndex === -1
        ? 0
        : (activeIndex + direction + profiles.length) % profiles.length;
    const nextProfile = profiles[nextIndex];

    if (!nextProfile || nextProfile.id === activeProfile?.id) {
      return;
    }

    lastProfileWheelAtRef.current = now;
    onSelectProfile(nextProfile.id);
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
    if (openControl !== "search") {
      return;
    }

    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [openControl]);

  const floatingActionButtonClass =
    "relative inline-flex size-12 items-center justify-center rounded-full border border-white/75 bg-white/70 text-muted-foreground shadow-[0_12px_32px_-20px_oklch(0.45_0.05_245_/_0.55),0_1px_0_oklch(1_0_0_/_0.92)_inset] backdrop-blur-2xl transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:border-sky-200/90 hover:bg-white/90 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:scale-100";
  const floatingActionButtonActiveClass =
    "border-sky-200/90 bg-sky-50/90 text-sky-600 shadow-[0_14px_36px_-18px_oklch(0.6_0.12_244_/_0.72),0_0_0_1px_oklch(0.76_0.13_244_/_0.25),0_1px_0_oklch(1_0_0_/_0.95)_inset]";
  const railOpen = railExpanded || openControl !== null;

  return (
    <header className="relative isolate z-[70] overflow-visible">
      <div className="relative overflow-visible border-b border-foreground/10 py-2">
        <button
          type="button"
          aria-label="Open settings"
          aria-expanded={settingsMode !== "closed"}
          onClick={() =>
            setSettingsMode((mode) => (mode === "menu" ? "closed" : "menu"))
          }
          className="soft-control absolute right-0 top-[calc(50%-1.25rem)] inline-flex size-10 items-center justify-center rounded-full border text-sky-500 transition hover:scale-105 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95"
        >
          <Settings className="size-4" />
        </button>
        {settingsMode === "menu" ? (
          <div className="soft-panel-strong absolute right-0 top-[calc(50%+1.75rem)] z-[90] min-w-36 rounded-2xl border p-2">
            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.22em] text-foreground transition hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              onClick={() => setSettingsMode("graphs")}
            >
              Graphs
            </button>
          </div>
        ) : null}
        <div className="mb-2 flex min-w-0 items-center pr-12">
          <h1 className="sr-only">S-Drive</h1>
          <div className="relative flex min-h-11 min-w-0 flex-1 items-center self-stretch overflow-visible">
            <button
              type="button"
              aria-label={
                activeProfile
                  ? `Open profile settings for ${activeProfile.name}`
                  : "Choose active profile"
              }
              onClick={onOpenProfiles}
              className="group flex h-[3.75rem] min-w-0 shrink-0 items-center gap-3 px-1 pr-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <ProfileAvatar profile={activeProfile} size="lg" live={Boolean(activeProfile)} />
              <span className="min-w-0 max-w-[8rem] truncate text-sm font-semibold leading-none tracking-tight sm:max-w-[10rem]">
                {activeProfile ? activeProfile.name : "Choose profile"}
              </span>
            </button>

            <div
              aria-label={otherProfiles.length > 0 ? "Switch active profile" : undefined}
              className="flex min-w-0 flex-1 items-center overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onWheel={handleProfileWheel}
              role={otherProfiles.length > 0 ? "group" : undefined}
            >
              <div className="flex h-[3.25rem] items-center gap-2">
                {otherProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    aria-label={`Switch to ${profile.name}`}
                    onClick={() => onSelectProfile(profile.id)}
                    className="group/avatar relative inline-flex size-11 shrink-0 items-center justify-center rounded-full opacity-40 transition duration-200 ease-out hover:scale-105 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95"
                  >
                    <span className="absolute inset-0 rounded-full bg-background/60 opacity-0 transition group-hover/avatar:opacity-100" />
                    <ProfileAvatar profile={profile} size="md" />
                  </button>
                ))}
                <HeaderSdMark />
              </div>
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
                    aria-label="Open search"
                    aria-expanded={openControl === "search"}
                    aria-pressed={openControl === "search"}
                    onClick={() => {
                      setRailExpanded(true);
                      setOpenControl((current) => (current === "search" ? null : "search"));
                    }}
                    className={cn(
                      floatingActionButtonClass,
                      (openControl === "search" || search) && floatingActionButtonActiveClass
                    )}
                  >
                    <Search className="size-4" />
                    {search ? (
                      <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-sky-500 shadow-[0_0_10px_oklch(0.76_0.13_244_/_0.6)]" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label="Open contact filters"
                    aria-expanded={openControl === "filter"}
                    aria-pressed={openControl === "filter"}
                    onClick={() => {
                      setRailExpanded(true);
                      setOpenControl((current) => (current === "filter" ? null : "filter"));
                    }}
                    className={cn(
                      floatingActionButtonClass,
                      (openControl === "filter" || profileFilter !== "all") &&
                        floatingActionButtonActiveClass
                    )}
                  >
                    <SlidersHorizontal className="size-4" />
                    {profileFilter !== "all" ? (
                      <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-sky-500 shadow-[0_0_10px_oklch(0.76_0.13_244_/_0.6)]" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label="Open follow-up tasks"
                    aria-expanded={openControl === "followup"}
                    aria-pressed={openControl === "followup"}
                    onClick={() => {
                      setRailExpanded(true);
                      setOpenControl((current) => (current === "followup" ? null : "followup"));
                    }}
                    className={cn(
                      floatingActionButtonClass,
                      openControl === "followup" && floatingActionButtonActiveClass,
                      followUpItems.length > 0 && "text-sky-600"
                    )}
                  >
                    <NikeSwoosh className="size-5" />
                    {followUpItems.length > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border border-white/80 bg-sky-500 px-1.5 text-[0.58rem] font-black leading-5 text-white shadow-[0_8px_18px_-8px_oklch(0.45_0.12_244_/_0.8),0_0_12px_oklch(0.76_0.13_244_/_0.5)]">
                        {Math.min(followUpItems.length, 9)}
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
                "relative inline-flex size-14 items-center justify-center rounded-full border border-white/80 bg-white/80 text-sky-600 shadow-[0_18px_42px_-22px_oklch(0.45_0.08_245_/_0.7),0_1px_0_oklch(1_0_0_/_0.95)_inset] backdrop-blur-2xl transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-95",
                railOpen && floatingActionButtonActiveClass
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "quick-actions-diamond-shine absolute inset-[0.22rem] rounded-full transition-opacity duration-200",
                  railOpen ? "opacity-0" : "opacity-100"
                )}
              />
              <Plus
                className={cn("relative z-10 size-5 transition-transform duration-200", railOpen && "rotate-45")}
              />
              {followUpItems.length > 0 && !railOpen ? (
                <span className="absolute -right-1 -top-1 z-20 inline-flex min-w-5 items-center justify-center rounded-full border border-white/80 bg-sky-500 px-1.5 text-[0.58rem] font-black leading-5 text-white shadow-[0_8px_18px_-8px_oklch(0.45_0.12_244_/_0.8),0_0_12px_oklch(0.76_0.13_244_/_0.5)]">
                  {Math.min(followUpItems.length, 9)}
                </span>
              ) : null}
              {(search || profileFilter !== "all") && followUpItems.length === 0 && !railOpen ? (
                <span className="absolute right-2 top-2 z-20 size-2 rounded-full bg-sky-500 shadow-[0_0_10px_oklch(0.76_0.13_244_/_0.6)]" />
              ) : null}
            </button>

            {openControl === "search" ? (
              <div className="soft-panel-strong absolute bottom-0 right-full z-[100] mr-3 w-[min(20rem,calc(100vw-5.5rem))] origin-bottom-right rounded-3xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <span className="text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Search contacts
                  </span>
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={() => setOpenControl(null)}
                    className="rounded-full p-1 text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <label className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
                  <span className="sr-only">Search people</span>
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => onSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setOpenControl(null);
                      }
                    }}
                    placeholder="Search by name, owner, or note"
                    className="soft-inset h-12 w-full rounded-2xl border px-3 pl-11 pr-10 text-sm font-medium tracking-tight outline-none transition placeholder:font-normal placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/25"
                  />
                  {search ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => onSearch("")}
                      className="absolute right-3 rounded-full p-1 text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </label>
              </div>
            ) : null}

            {openControl === "filter" ? (
              <div className="soft-panel-strong absolute bottom-0 right-full z-[100] mr-3 w-[min(18rem,calc(100vw-5.5rem))] origin-bottom-right rounded-3xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <span className="text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Filter contacts
                  </span>
                  <button
                    type="button"
                    aria-label="Close filters"
                    onClick={() => setOpenControl(null)}
                    className="rounded-full p-1 text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <label className="relative flex items-center">
                  <span className="sr-only">Filter by owner</span>
                  <select
                    value={profileFilter}
                    onChange={(event) => onProfileFilterChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setOpenControl(null);
                      }
                    }}
                    className="soft-inset h-12 w-full appearance-none rounded-2xl border px-4 pr-9 text-sm font-medium tracking-tight outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                    aria-label="Filter by owner"
                  >
                    <option value="all">All contacts</option>
                    <option value="mine">My contacts</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-4 size-3.5 rotate-90 text-muted-foreground" />
                </label>
                <p className="mt-2 px-1 text-xs text-muted-foreground">
                  Showing {activeFilterLabel}.
                </p>
              </div>
            ) : null}

            {openControl === "followup" ? (
              <div className="absolute bottom-0 right-full z-[100] mr-3 w-[min(22rem,calc(100vw-5.5rem))] origin-bottom-right rounded-3xl border border-white/45 bg-white/40 p-3 shadow-[0_24px_70px_-38px_oklch(0.4_0.08_240_/_0.55)] backdrop-blur-2xl">
                <div className="relative mb-3 px-8 text-center">
                  <div className="pointer-events-none">
                    <p className="text-[0.64rem] font-black tracking-[0.22em] text-sky-600">
                      Notifications
                    </p>
                    <p className="mt-1 text-xs font-black text-sky-600">
                      To-do list
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close follow-up tasks"
                    onClick={() => setOpenControl(null)}
                    className="absolute right-1 top-0 z-10 rounded-full p-1 text-muted-foreground transition hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="max-h-[24rem] overflow-y-auto pr-1">
                  {followUpItems.length > 0 ? (
                    <motion.ul
                      aria-label="People needing follow-up"
                      className="space-y-2"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: {},
                        visible: {
                          transition: {
                            staggerChildren: 0.07,
                          },
                        },
                      }}
                    >
                      {followUpItems.map((item, index) => {
                        const typeDelay = 0.12 + index * 0.08;
                        const typeDuration = Math.min(0.95, 0.38 + item.person.name.length * 0.018);

                        return (
                          <motion.li
                            key={item.person.id}
                            className="soft-inset grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border bg-white/50 px-3 py-2.5"
                            variants={{
                              hidden: { opacity: 0, y: 8, scale: 0.98 },
                              visible: { opacity: 1, y: 0, scale: 1 },
                            }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                          >
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-sky-500/90 text-[0.65rem] font-black text-white shadow-[0_0_16px_oklch(0.76_0.13_244_/_0.38)]">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="flex min-w-0 items-center text-sm font-black text-foreground">
                                <motion.span
                                  className="min-w-0 truncate"
                                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                                  animate={{ clipPath: "inset(0 0% 0 0)" }}
                                  transition={{
                                    duration: typeDuration,
                                    delay: typeDelay,
                                    ease: "easeOut",
                                  }}
                                >
                                  {item.person.name}
                                </motion.span>
                                <motion.span
                                  aria-hidden="true"
                                  className="ml-0.5 h-4 w-px shrink-0 rounded-full bg-sky-500/75"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: [0, 1, 1, 0] }}
                                  transition={{
                                    duration: typeDuration + 0.22,
                                    delay: typeDelay,
                                    ease: "easeOut",
                                    times: [0, 0.12, 0.78, 1],
                                  }}
                                />
                              </p>
                              <p className="truncate text-[0.68rem] font-bold text-muted-foreground">
                                {item.stageLabel} · {item.ownerLabel}
                              </p>
                              <p className="truncate text-[0.62rem] font-semibold text-muted-foreground/80">
                                Last: {item.latestActivity.label}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black leading-none text-sky-600">
                                {item.daysQuiet}
                              </p>
                              <p className="text-[0.55rem] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                days
                              </p>
                            </div>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  ) : (
                    <div className="grid min-h-[9rem] place-items-center rounded-2xl border border-sky-200/45 bg-white/25 px-4 py-6 text-center">
                      <Check className="size-6 text-sky-500" aria-hidden="true" />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        </div>
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
        onClose={() => setSettingsMode("closed")}
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
  onClose,
}: {
  open: boolean;
  people: BoardPerson[];
  profiles: BoardProfile[];
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
  const graphData = STAGES.map((stage, index) => ({
    id: stage.id,
    index: stageIndex[stage.id],
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

                    <DashboardPanel action={`${total} contacts`} title="Stage Report">
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
                    <DashboardPanel action="all sections" title="Pipeline Sections">
                      <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-white/45">
                        <div className="grid grid-cols-[1fr_3.5rem_3.5rem] bg-foreground/[0.035] px-3 py-1.5 text-[0.52rem] font-black uppercase tracking-[0.14em] text-muted-foreground">
                          <span>Section</span>
                          <span className="text-right">People</span>
                          <span className="text-right">Share</span>
                        </div>
                        {graphData.map((item) => {
                          const share = total === 0 ? 0 : Math.round((item.count / total) * 100);

                          return (
                            <div key={item.id} className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center border-t border-foreground/10 px-3 py-1 text-[0.68rem]">
                              <span className="flex min-w-0 items-center gap-2 font-bold text-foreground">
                                <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                                <span className="truncate">{item.label}</span>
                              </span>
                              <span className="text-right font-black">{item.count}</span>
                              <span className="text-right text-xs font-bold text-muted-foreground">{share}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </DashboardPanel>

                    <DashboardPanel action={`${activeUserCount} active`} title="User Days This Month">
                      <div className="space-y-1">
                        {userRows.length > 0 ? (
                          userRows.slice(0, 6).map((item) => (
                            <div key={item.profile.id} className="soft-inset grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border px-2 py-1">
                              <ProfileAvatar profile={item.profile} size="xs" />
                              <div className="min-w-0">
                                <p className="truncate text-[0.68rem] font-black text-foreground">{item.profile.name}</p>
                                <p className="text-[0.58rem] font-bold text-muted-foreground">
                                  {item.contacts} contacts · {item.studies} studies
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black leading-none text-sky-600">{item.averageDays}</p>
                                <p className="text-[0.52rem] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                  days
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="soft-inset rounded-2xl border px-4 py-8 text-center text-sm font-bold text-muted-foreground">
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
  title,
  children,
}: {
  action?: string;
  className?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("soft-panel rounded-[1.1rem] border p-2.5", className)}>
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
      <div className="grid min-h-[42rem] w-max grid-cols-6 gap-4 md:min-w-[1180px] xl:w-full">
        {STAGES.map((stage, index) => {
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

function StageLane({
  stage,
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
  stage: (typeof STAGES)[number];
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
  const tone = stageTones[stage.id];

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
              {stageIndex[stage.id]}
            </span>
            <span className={cn("inline-block size-1.5 shrink-0 rounded-full", tone.dot)} />
            <h2 className="min-w-0 truncate font-display text-2xl leading-[0.95] tracking-display text-foreground">
              {stage.label}
            </h2>
            {stage.id === "hunting" ? <SeedSproutAnimation /> : null}
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
          <div className="flex flex-1 flex-col gap-3 p-3">
            {people.map((person) => (
              <SortablePersonCard
                key={person.id}
                person={person}
                profiles={profiles}
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
                  {emptyMessages[stage.id]}
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
  configured,
  onClose,
  onCreated,
  onProfilesChange,
  onNotice,
}: {
  open: boolean;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  onClose: () => void;
  onCreated: (person: BoardPerson) => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  onNotice: (message?: string) => void;
}) {
  const [stage, setStage] = useState<StageId>(STAGES[0].id);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(() =>
    activeProfile ? [activeProfile.id] : []
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setStage(STAGES[0].id);
      setSelectedProfileIds(activeProfile ? [activeProfile.id] : []);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeProfile, open]);

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
        className="soft-panel-strong w-full max-w-md rounded-lg border p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative mb-4 flex items-center justify-center">
          <h2 className="text-center font-display text-3xl leading-none tracking-display">
            New Contacts
          </h2>
          <button
            aria-label="Close add contact"
            className="soft-control absolute right-0 inline-flex size-9 items-center justify-center rounded-md border text-muted-foreground transition hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
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
            className="soft-inset h-12 w-full rounded-md border px-4 text-sm font-medium tracking-tight outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/20"
          />
          <select
            aria-label="Starting stage"
            className="soft-inset h-12 w-full rounded-md border px-4 text-sm font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            onChange={(event) => {
              if (isStageId(event.target.value)) {
                setStage(event.target.value);
              }
            }}
            value={stage}
          >
            {STAGES.map((item) => (
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
          />
          <textarea
            name="notes"
            placeholder="Care notes (optional)"
            rows={3}
            className="soft-inset w-full resize-none rounded-md border px-4 py-3 text-sm leading-5 outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button className="rounded-md" disabled={isPending} onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button className="rounded-md" disabled={isPending || selectedProfileIds.length < 1} type="submit">
            Save contact
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function SeedSproutAnimation() {
  return (
    <motion.span
      aria-hidden
      className="relative ml-0.5 inline-flex size-6 shrink-0 items-end justify-center"
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        className="absolute bottom-1 h-3 w-1 rounded-full bg-sky-500/80"
        animate={{ scaleY: [0.75, 1.08, 0.82] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute bottom-3 left-2 h-2.5 w-3 rounded-[999px_999px_999px_0] bg-sky-300/90 shadow-[0_0_12px_oklch(0.76_0.13_244_/_0.38)]"
        animate={{ rotate: [-12, -24, -12], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute bottom-3 right-2 h-2.5 w-3 rounded-[999px_999px_0_999px] bg-cyan-200/95 shadow-[0_0_12px_oklch(0.76_0.13_244_/_0.35)]"
        animate={{ rotate: [12, 24, 12], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="absolute bottom-0 h-2.5 w-4 rounded-[999px_999px_999px_999px] bg-sky-700/75 shadow-[0_5px_12px_oklch(0.58_0.032_250_/_0.18)]" />
    </motion.span>
  );
}

function SortablePersonCard({
  person,
  profiles,
  activeProfile,
  configured,
  disabled,
  onMove,
  onNotice,
  onSelect,
  onReactionLogged,
}: {
  person: BoardPerson;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  disabled?: boolean;
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
  } = useSortable({ id: person.id });
  const [collapsed, setCollapsed] = useState(false);
  const previousStage = getNextStage(person.stage, -1);
  const nextStage = getNextStage(person.stage, 1);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tone = stageTones[person.stage];
  const assignedProfiles = getAssignedProfiles(person, profiles);
  const hasFollowUp = Boolean(person.next_follow_up_at);
  const latestReaction = getLatestContactReaction(person.events);
  const latestStudy = getLatestCompletedStudy(person.studies);
  const totalStudies = person.studies.length;
  const overdueReaction = isReactionOverdue(latestReaction);
  const collapsedProfile = assignedProfiles[0] ?? activeProfile;
  const collapseButton = (
    <button
      aria-label={collapsed ? `Expand ${person.name}` : `Collapse ${person.name}`}
      aria-pressed={collapsed}
      className={cn(
        "absolute left-2 top-3 z-10 inline-flex size-7 items-center justify-center rounded-full border bg-background/85 shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95",
        collapsed
          ? "border-amber-400 text-amber-700"
          : "border-foreground/10 text-foreground/35 hover:border-amber-300 hover:text-amber-600"
      )}
      onClick={() => setCollapsed((value) => !value)}
      type="button"
    >
      <Star className={cn("size-3.5", collapsed && "fill-current")} />
    </button>
  );

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      className={cn(
        "soft-control group relative overflow-hidden rounded-2xl border border-transparent ring-1 ring-inset transition-all",
        tone.ring,
        "hover:-translate-y-0.5 hover:cyan-accent",
        overdueReaction &&
          "border-red-400/70 ring-red-400/55 shadow-[0_0_0_1px_oklch(0.64_0.2_25_/_0.22),0_0_28px_oklch(0.64_0.2_25_/_0.24)]",
        isDragging && "opacity-40"
      )}
      whileTap={{ scale: 0.99 }}
    >
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", tone.card)}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          tone.edge
        )}
      />

      {collapsed ? (
        <div className="relative flex min-h-14 items-center gap-3 py-2 pl-12 pr-3">
          <button
            aria-label={`Expand ${person.name}`}
            aria-pressed={collapsed}
            className="absolute left-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400 bg-background/85 text-amber-700 shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95"
            onClick={() => setCollapsed(false)}
            type="button"
          >
            <Star className="size-3.5 fill-current" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-start gap-3">
            <ProfileAvatar profile={collapsedProfile} size="icon" />
            <button
              className="min-w-0 text-left"
              onClick={() => onSelect(person.id)}
              type="button"
            >
              <h3 className="truncate font-display text-xl leading-none tracking-display text-foreground">
                {person.name}
              </h3>
            </button>
          </div>
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200/80 bg-white/75 px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-sky-700 shadow-[0_1px_0_oklch(1_0_0_/_0.8)_inset,0_8px_18px_oklch(0.62_0.15_235_/_0.16)]"
            title={`${totalStudies} total studies`}
            aria-label={`${totalStudies} total studies`}
          >
            <span className="font-sans text-base leading-none tracking-tight text-sky-600">
              {totalStudies}
            </span>
            <span className="hidden sm:inline">Studies</span>
          </span>
        </div>
      ) : (
        <>
          <div className="relative flex min-h-10 items-center px-3.5 pt-3">
            {collapseButton}
            <Button
              aria-label={`Move ${person.name} backward`}
              disabled={!configured || disabled || !previousStage}
              onClick={() => previousStage && onMove(person, previousStage)}
              size="icon-sm"
              type="button"
              variant="ghost"
              className="absolute left-8 top-3 size-7"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <button
              className="mx-auto min-w-0 max-w-full px-10 text-center"
              type="button"
              onClick={() => onSelect(person.id)}
            >
              <h3 className="truncate font-display text-2xl leading-none tracking-display text-foreground transition group-hover:text-foreground">
                {person.name}
              </h3>
            </button>
            <Button
              aria-label={`Move ${person.name} forward`}
              disabled={!configured || disabled || !nextStage}
              onClick={() => nextStage && onMove(person, nextStage)}
              size="icon-sm"
              type="button"
              variant="ghost"
              className="absolute right-8 top-3 size-7"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            {hasFollowUp ? (
              <span className="absolute right-3 top-12 shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[0.6rem] font-medium tracking-[0.12em] text-foreground/70">
                {formatDate(person.next_follow_up_at)}
              </span>
            ) : null}
          </div>

          {latestStudy ? (
            <p className="relative mx-3.5 mt-3 line-clamp-2 border-l-2 border-foreground/10 pl-3 text-[0.78rem] leading-5 text-muted-foreground">
              <span className="font-medium text-foreground/80">Last study:</span>{" "}
              {getStudyTitle(latestStudy)}
              <span className="text-foreground/40"> · </span>
              <span>{formatDate(latestStudy.studied_at)}</span>
            </p>
          ) : null}

          {person.stage === "baptized" && person.baptized_at ? (
            <p className="relative mx-3.5 mt-3 text-[0.62rem] font-medium uppercase tracking-[0.2em] text-amber-700">
              Baptized {new Date(person.baptized_at).toLocaleDateString()}
            </p>
          ) : null}

          <div className="relative mt-4 flex min-w-0 items-center gap-1.5 border-t border-foreground/[0.07] bg-foreground/[0.015] px-3 py-2">
            {assignedProfiles.length > 0 ? (
              <div className="flex -space-x-1.5">
                {assignedProfiles.slice(0, 3).map((profile) => (
                  <ProfileAvatar key={profile.id} profile={profile} size="xs" />
                ))}
              </div>
            ) : (
              <span className="shrink-0 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Unassigned
              </span>
            )}
            <div className="absolute left-1/2 top-1/2 flex min-w-0 max-w-[58%] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1">
              {latestReaction ? (
                <>
                  <div className="flex min-w-0 items-center gap-1 text-[0.66rem] font-medium text-muted-foreground">
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
                  <div className="absolute left-[calc(100%+0.75rem)] top-1/2 -translate-y-1/2">
                    <ContactReactionControls
                      person={person}
                      activeProfile={activeProfile}
                      configured={configured}
                      disabled={disabled}
                      onNotice={onNotice}
                      onReactionLogged={onReactionLogged}
                      compact
                    />
                  </div>
                </>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              {latestReaction ? null : (
                  <ContactReactionControls
                    person={person}
                    activeProfile={activeProfile}
                    configured={configured}
                    disabled={disabled}
                    onNotice={onNotice}
                    onReactionLogged={onReactionLogged}
                    compact
                  />
              )}
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
}: {
  person: BoardPerson;
  profiles: BoardProfile[];
}) {
  const tone = stageTones[person.stage];
  return (
    <article
      className={cn(
        "soft-panel relative w-72 rotate-1 overflow-hidden rounded-2xl border border-transparent p-4 ring-1 ring-inset",
        tone.ring
      )}
    >
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", tone.card)}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          tone.edge
        )}
      />
      <p className="relative font-display text-xl leading-[1.05] tracking-display">{person.name}</p>
      <p className="relative mt-1.5 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {profileNames(person, profiles)}
      </p>
      <ProfileStack profiles={getAssignedProfiles(person, profiles)} className="relative mt-3" />
    </article>
  );
}

function PersonDetailPanel({
  person,
  profiles,
  activeProfile,
  configured,
  onClose,
  onUpdated,
  onProfilesChange,
  onNotice,
  onStudyLogged,
  onStudyRenamed,
  onStudyDeleted,
}: {
  person: BoardPerson | null;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  onClose: () => void;
  onUpdated: (person: BoardPerson) => void;
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
  const [lifeStatus, setLifeStatus] = useState<PersonLifeStatus | null>(
    person?.life_status ?? null
  );
  const [detailTabsCollapsed, setDetailTabsCollapsed] = useState(false);
  const [assignmentPopupOpen, setAssignmentPopupOpen] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(person?.name ?? "");
  const [studySelection, setStudySelection] = useState<{
    studyNumber: number;
    focusKey: number;
  } | null>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
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
      setLifeStatus(person.life_status);
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

  function selectLifeStatus(nextStatus: PersonLifeStatus) {
    if (!canEditPerson() || !person || !activeProfile) {
      return;
    }

    const previousStatus = lifeStatus;
    const nextLifeStatus = previousStatus === nextStatus ? null : nextStatus;

    setLifeStatus(nextLifeStatus);
    startTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        lifeStatus: nextLifeStatus,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        setLifeStatus(previousStatus);
        onNotice(result.ok ? "The person could not be updated." : result.error);
        return;
      }

      onNotice(undefined);
      setLifeStatus(result.data.life_status);
      onUpdated(result.data);
    });
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
                  stageTones[person.stage].glow
                )}
              />
              <div className="relative flex items-start justify-between gap-4 border-b border-foreground/[0.07] px-6 pb-5 pt-6">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleAvatarChange}
                />
                <div className="min-w-0 flex-1">
                    <div className="mb-3 flex w-full flex-col items-start justify-start gap-2 text-left uppercase text-muted-foreground">
                      <div className="flex max-w-full flex-wrap items-center justify-start gap-2 text-[0.66rem] font-semibold tracking-[0.28em] sm:tracking-[0.38em]">
                      <span
                        className={cn("size-1.5 rounded-full", stageTones[person.stage].dot)}
                      />
                      <span className="whitespace-nowrap">
                        {stageIndex[person.stage]} ·{" "}
                        {STAGES.find((s) => s.id === person.stage)?.label}
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
                    <div className="flex min-w-0 items-center gap-3">
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
                            className="soft-inset w-full min-w-0 rounded-xl border px-2 py-1 font-display text-[clamp(1.8rem,4vw,2.45rem)] leading-none tracking-display text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/15"
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
                          <h2 className="flex min-w-0 items-center gap-2 font-display text-[clamp(1.8rem,4vw,2.45rem)] leading-none tracking-display text-foreground">
                            <button
                              type="button"
                              aria-label={`Rename ${person.name}`}
                              className="-mx-1 block min-w-0 max-w-full truncate rounded-xl px-1 text-left outline-none transition hover:bg-background/45 focus-visible:ring-2 focus-visible:ring-ring/20"
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
                <div className="flex shrink-0 items-start gap-2">
                  <PipelineDaysLine days={daysInPipeline(person.created_at)} />
                  <span className="flex shrink-0 items-center gap-1.5 text-sky-500">
                    <button
                      type="button"
                      aria-label="Mark as university student"
                      aria-pressed={lifeStatus === "student"}
                      className={cn(
                        "soft-control inline-flex size-7 items-center justify-center rounded-full border transition hover:-translate-y-0.5 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95",
                        lifeStatus === "student" &&
                          "border-white/90 bg-white/45 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.95)] shadow-[0_0_0_2px_oklch(1_0_0_/_0.72),0_0_20px_oklch(1_0_0_/_0.9),0_0_28px_oklch(0.76_0.13_244_/_0.38)]"
                      )}
                      onClick={() => selectLifeStatus("student")}
                    >
                      <School className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Mark as worker"
                      aria-pressed={lifeStatus === "worker"}
                      className={cn(
                        "soft-control inline-flex size-7 items-center justify-center rounded-full border transition hover:-translate-y-0.5 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95",
                        lifeStatus === "worker" &&
                          "border-white/90 bg-white/45 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.95)] shadow-[0_0_0_2px_oklch(1_0_0_/_0.72),0_0_20px_oklch(1_0_0_/_0.9),0_0_28px_oklch(0.76_0.13_244_/_0.38)]"
                      )}
                      onClick={() => selectLifeStatus("worker")}
                    >
                      <Briefcase className="size-3.5" />
                    </button>
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
                      aria-pressed={detailTabsCollapsed}
                      className={cn(
                        "absolute left-0 inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-foreground/35 transition hover:border-amber-300 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95",
                        detailTabsCollapsed && "border-amber-400 text-amber-700"
                      )}
                      onClick={() => setDetailTabsCollapsed((value) => !value)}
                      type="button"
                    >
                      <Star className={cn("size-3.5", detailTabsCollapsed && "fill-current")} />
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
                    <ProfileAssignmentPicker
                      hideHeader
                      profiles={profiles}
                      selectedIds={
                        selectedProfileIds.length > 0
                          ? selectedProfileIds
                          : person.assigned_profile_ids
                      }
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
        {studies.map((study) => {
          const actor = profiles.find(
            (profile) => profile.id === study.actor_profile_id
          );
          return (
            <StudyTimelineItem
              key={study.id}
              study={study}
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
  actor: BoardProfile | null;
  personId: string;
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onStudyRenamed: (personId: string, study: PersonStudy) => void;
  onStudyDeleted: (personId: string, studyId: string) => void;
  onStudySelected: (studyNumber: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(getStudyTitle(study));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timestampVisible, setTimestampVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const studyTitle = getStudyTitle(study);

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

  function handleRename(formData: FormData) {
    if (!requireStudyAction() || !activeProfile) {
      return;
    }

    const nextTitle = String(formData.get("title") ?? "").trim();

    if (!nextTitle) {
      onNotice("Study name cannot be empty.");
      return;
    }

    startTransition(async () => {
      const result = await updatePersonStudyTitle({
        id: study.id,
        title: nextTitle,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The study name could not be saved." : result.error);
        return;
      }

      onNotice(undefined);
      onStudyRenamed(personId, result.data);
      setTitle(getStudyTitle(result.data));
      setIsEditing(false);
    });
  }

  function handleDelete() {
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
        {study.study_number}
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
            {isEditing ? (
              <form action={handleRename} className="flex min-w-0 items-center gap-1.5">
                <input
                  autoFocus
                  className="soft-inset h-8 min-w-0 flex-1 rounded-lg border px-2 text-[0.82rem] font-medium tracking-tight outline-none transition focus-visible:ring-2 focus-visible:ring-ring/15"
                  maxLength={80}
                  name="title"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
                <Button disabled={isPending} size="sm" type="submit" className="h-8 px-2.5">
                  Save
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => {
                    setTitle(getStudyTitle(study));
                    setIsEditing(false);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                  className="h-8 px-2.5"
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  aria-label={`Open care notes for ${studyTitle}`}
                  className="min-w-0 truncate text-left text-[0.85rem] font-medium tracking-tight text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                  onClick={() => onStudySelected(study.study_number)}
                  type="button"
                >
                  {studyTitle}
                </button>
                <button
                  aria-label={`Rename ${studyTitle}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => {
                    if (requireStudyAction()) {
                      setConfirmDelete(false);
                      setIsEditing(true);
                    }
                  }}
                  type="button"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
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
        {study.notes ? (
          <button
            aria-label={`Open care notes for ${studyTitle}`}
            className="mt-2 block w-full border-l-2 border-foreground/10 pl-3 text-left text-[0.78rem] leading-5 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            onClick={() => onStudySelected(study.study_number)}
            type="button"
          >
            {study.notes}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function ContactAvatar({
  person,
  size = "md",
}: {
  person: BoardPerson | null;
  size?: "md" | "lg";
}) {
  const sizeClass = {
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/15 bg-card font-display tracking-display text-foreground/80 shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset]",
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

function PipelineDaysLine({ days }: { days: number }) {
  const digits = String(days).padStart(2, "0").split("");

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 font-sans tracking-normal"
      title={`${days} days in the pipeline`}
      aria-label={`${days} days in the pipeline`}
    >
      {digits.map((digit, index) => (
        <span
          key={`${digit}-${index}`}
          className="relative inline-flex h-10 w-8 items-center justify-center overflow-hidden rounded-md border border-slate-950/40 bg-slate-900 text-lg font-black leading-none text-white shadow-[0_2px_0_oklch(0.13_0.02_264),0_10px_20px_-14px_oklch(0.2_0.028_264_/_0.6)]"
        >
          <span className="absolute inset-x-0 top-1/2 h-px bg-white/12" />
          <span className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.04]" />
          <span className="relative">{digit}</span>
        </span>
      ))}
    </span>
  );
}

function HeaderSdMark() {
  return (
    <span aria-hidden="true" className="s-drive-header-mark" title="S-Drive">
      <span className="s-drive-header-mark__letters" data-text="SD">
        SD
      </span>
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
  profiles,
  selectedIds,
  onChange,
  onProfilesChange,
  shape = "soft",
}: {
  hideHeader?: boolean;
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
                    <span className="mt-1.5 max-w-full truncate text-[0.72rem] font-medium tracking-tight text-foreground">
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
                      "flex size-8 items-center justify-center border border-dashed border-foreground/20 text-muted-foreground",
                      isSquare ? "rounded-md" : "rounded-full"
                    )}
                  >
                    <Plus className="size-3.5" />
                  </span>
                  <span className="mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
