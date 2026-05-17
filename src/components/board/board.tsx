"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type WheelEvent,
} from "react";
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
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MessageCircle,
  Phone,
  Pencil,
  Plus,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import {
  addContactReaction,
  addPersonStudy,
  createPerson,
  deletePersonStudy,
  movePerson,
  updatePersonStudyTitle,
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
    text: "text-amber-900",
    soft: "bg-amber-50 text-amber-950",
    ring: "ring-amber-400/55",
    dot: "bg-amber-500",
    card: "from-amber-100/55 via-amber-50/20 to-transparent",
    edge: "via-amber-400/50",
    glow: "from-amber-200/45 via-amber-100/0 to-transparent",
  },
  first_bible_study: {
    text: "text-slate-700",
    soft: "bg-slate-100 text-slate-900",
    ring: "ring-slate-400/65",
    dot: "bg-slate-500",
    card: "from-slate-100/60 via-slate-50/25 to-transparent",
    edge: "via-slate-400/45",
    glow: "from-slate-200/35 via-slate-100/0 to-transparent",
  },
  third_bible_study: {
    text: "text-indigo-800",
    soft: "bg-indigo-50 text-indigo-950",
    ring: "ring-indigo-400/50",
    dot: "bg-indigo-500",
    card: "from-indigo-100/50 via-indigo-50/20 to-transparent",
    edge: "via-indigo-400/45",
    glow: "from-indigo-200/40 via-indigo-100/0 to-transparent",
  },
  seventh_bible_study: {
    text: "text-violet-800",
    soft: "bg-violet-50 text-violet-950",
    ring: "ring-violet-400/50",
    dot: "bg-violet-500",
    card: "from-violet-100/50 via-violet-50/20 to-transparent",
    edge: "via-violet-400/45",
    glow: "from-violet-200/40 via-violet-100/0 to-transparent",
  },
  ready_for_baptism: {
    text: "text-emerald-800",
    soft: "bg-emerald-50 text-emerald-950",
    ring: "ring-emerald-400/50",
    dot: "bg-emerald-500",
    card: "from-emerald-100/50 via-emerald-50/20 to-transparent",
    edge: "via-emerald-400/45",
    glow: "from-emerald-200/40 via-emerald-100/0 to-transparent",
  },
  baptized: {
    text: "text-yellow-800",
    soft: "bg-yellow-50 text-yellow-950",
    ring: "ring-yellow-400/55",
    dot: "bg-yellow-500",
    card: "from-yellow-100/55 via-amber-50/20 to-transparent",
    edge: "via-amber-400/50",
    glow: "from-yellow-200/45 via-yellow-100/0 to-transparent",
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

const TOTAL_STUDIES = 30;

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

function getStudyTitle(study: PersonStudy) {
  return study.title?.trim() || `Study ${study.study_number}`;
}

function buildStudyTimelineCopy(
  person: BoardPerson,
  studies: PersonStudy[],
  profiles: BoardProfile[]
) {
  const studyLines = sortStudies(studies).map((study) => {
    const actor = profiles.find((profile) => profile.id === study.actor_profile_id);
    const actorName = actor?.name || person.teacher || "System";
    const notes = study.notes?.trim().replace(/\s+/g, " ");
    const details = [
      getStudyTitle(study),
      formatDate(study.studied_at),
      actorName,
      notes,
    ].filter(Boolean);

    return `${study.study_number}. ${details.join(" - ")}`;
  });

  return [`Bible study timeline for ${person.name}`, "", ...studyLines].join("\n");
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

function getMonthValue(value: string | null | undefined) {
  return value ? value.slice(0, 7) : "";
}

function getMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);

  if (!year || !month) {
    return "Month";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function shiftMonth(monthValue: string, offset: number) {
  const [year, month] = monthValue.split("-").map(Number);

  if (!year || !month) {
    return monthValue;
  }

  const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1));
  const nextYear = nextMonth.getUTCFullYear();
  const nextMonthNumber = String(nextMonth.getUTCMonth() + 1).padStart(2, "0");

  return `${nextYear}-${nextMonthNumber}`;
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
  const [people, setPeople] = useState(initialPeople);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState(error);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const activeProfileId = useSyncExternalStore(
    onActiveProfileChange,
    getActiveProfileId,
    getActiveProfileServerSnapshot
  );
  const [isPending, startTransition] = useTransition();

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground grain">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(80rem_55rem_at_90%_-15%,oklch(0.86_0.09_70_/_0.32),transparent_55%),radial-gradient(60rem_45rem_at_-5%_110%,oklch(0.6_0.09_265_/_0.18),transparent_55%),linear-gradient(180deg,var(--background)_0%,oklch(0.95_0.018_82)_60%,var(--background)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,oklch(0.2_0.028_264_/_0.18),transparent)]"
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
            onCreated={handleCreated}
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
        onNotice={setNotice}
        onStudyLogged={handleStudyLogged}
        onStudyRenamed={handleStudyRenamed}
        onStudyDeleted={handleStudyDeleted}
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
  configured: boolean;
  notice?: string;
}) {
  const [openControl, setOpenControl] = useState<"search" | "filter" | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastProfileWheelAtRef = useRef(0);
  const otherProfiles = profiles.filter((profile) => profile.id !== activeProfile?.id);
  const activeFilterLabel =
    profileFilter === "mine"
      ? "My contacts"
      : profileFilter === "all"
        ? "All contacts"
        : profiles.find((profile) => profile.id === profileFilter)?.name ?? "All contacts";

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

  useEffect(() => {
    if (openControl !== "search") {
      return;
    }

    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [openControl]);

  return (
    <header className="relative isolate z-[70] overflow-visible">
      <div className="relative overflow-visible rounded-3xl border border-foreground/10 bg-card/85 p-2 shadow-[0_1px_0_oklch(1_0_0_/_0.45)_inset,0_18px_50px_-32px_oklch(0.2_0.028_264_/_0.22)] backdrop-blur-xl">
        <div className="relative flex min-h-11 items-center overflow-visible pr-[5.75rem]">
          <button
            type="button"
            aria-label={
              activeProfile
                ? `Open profile settings for ${activeProfile.name}`
                : "Choose active profile"
            }
            onClick={onOpenProfiles}
            className={cn(
              "group flex h-11 w-[9.5rem] min-w-0 shrink-0 items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:w-[13.5rem] lg:w-[15rem]",
              activeProfile &&
                "bg-background/55 shadow-[0_1px_0_oklch(1_0_0_/_0.5)_inset]"
            )}
          >
            <ProfileAvatar profile={activeProfile} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-none tracking-tight">
              {activeProfile ? activeProfile.name : "Choose profile"}
            </span>
          </button>

          {otherProfiles.length > 0 ? (
            <div
              aria-label="Switch active profile"
              className="ml-1 flex min-w-0 flex-1 items-center overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onWheel={handleProfileWheel}
              role="group"
            >
              <div className="flex h-11 items-center gap-1.5">
                {otherProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    aria-label={`Switch to ${profile.name}`}
                    onClick={() => onSelectProfile(profile.id)}
                    className="group/avatar relative inline-flex size-9 shrink-0 items-center justify-center rounded-full opacity-40 transition duration-200 ease-out hover:scale-105 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-95"
                  >
                    <span className="absolute inset-0 rounded-full bg-background/60 opacity-0 transition group-hover/avatar:opacity-100" />
                    <ProfileAvatar profile={profile} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="absolute right-0 top-0 z-[80] flex items-center gap-1 overflow-visible">
            <button
              type="button"
              aria-label="Open search"
              aria-expanded={openControl === "search"}
              onClick={() => setOpenControl((current) => (current === "search" ? null : "search"))}
              className={cn(
                "relative inline-flex size-11 items-center justify-center rounded-2xl bg-background/45 text-muted-foreground transition hover:bg-background/75 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                search && "text-foreground"
              )}
            >
              <Search className="size-4" />
              {search ? (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
              ) : null}
            </button>
            <button
              type="button"
              aria-label="Open contact filters"
              aria-expanded={openControl === "filter"}
              onClick={() => setOpenControl((current) => (current === "filter" ? null : "filter"))}
              className={cn(
                "relative inline-flex size-11 items-center justify-center rounded-2xl bg-background/45 text-muted-foreground transition hover:bg-background/75 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                profileFilter !== "all" && "text-foreground"
              )}
            >
              <SlidersHorizontal className="size-4" />
              {profileFilter !== "all" ? (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
              ) : null}
            </button>

            {openControl === "search" ? (
              <div className="absolute right-0 top-full z-[100] mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-3xl border border-foreground/10 bg-card p-3 shadow-[0_24px_70px_-32px_oklch(0.2_0.028_264_/_0.38)]">
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
                    className="h-12 w-full rounded-2xl border border-foreground/10 bg-background/60 px-3 pl-11 pr-10 text-sm font-medium tracking-tight outline-none transition placeholder:font-normal placeholder:text-muted-foreground/70 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/25"
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
              <div className="absolute right-0 top-full z-[100] mt-2 w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-3xl border border-foreground/10 bg-card p-3 shadow-[0_24px_70px_-32px_oklch(0.2_0.028_264_/_0.38)]">
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
                    className="h-12 w-full appearance-none rounded-2xl border border-foreground/10 bg-background/60 px-4 pr-9 text-sm font-medium tracking-tight outline-none transition focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/25"
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
    </header>
  );
}

function JourneyBoard({
  people,
  profiles,
  activeProfile,
  configured,
  isPending,
  onCreated,
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
  onCreated: (person: BoardPerson) => void;
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
                onCreated={onCreated}
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
  onCreated,
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
  onCreated: (person: BoardPerson) => void;
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
        "group/lane relative flex h-full min-h-[42rem] w-[82vw] max-w-[22rem] flex-col rounded-[1.6rem] border bg-card/82 shadow-[0_1px_0_oklch(1_0_0_/_0.5)_inset,0_30px_60px_-32px_oklch(0.2_0.028_264_/_0.16)] transition-all md:w-auto md:max-w-none",
        isOver && "ring-2 ring-foreground/15 ring-offset-2 ring-offset-background"
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

      <div className="relative px-3 pb-3">
        <AddPersonForm
          stage={stage.id}
          profiles={profiles}
          activeProfile={activeProfile}
          configured={configured}
          onCreated={onCreated}
          onNotice={onNotice}
        />
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
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-[1.3rem] border border-dashed border-foreground/10 bg-background/40 p-6 text-center">
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

function AddPersonForm({
  stage,
  profiles,
  activeProfile,
  configured,
  onCreated,
  onNotice,
}: {
  stage: StageId;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  onCreated: (person: BoardPerson) => void;
  onNotice: (message?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(() =>
    activeProfile ? [activeProfile.id] : []
  );
  const [isPending, startTransition] = useTransition();

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
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={!configured || !activeProfile}
        onClick={() => {
          setSelectedProfileIds(activeProfile ? [activeProfile.id] : []);
          setOpen(true);
        }}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-foreground/15 bg-background/60 px-3 text-left text-xs font-medium tracking-tight text-muted-foreground transition",
          "hover:border-foreground/30 hover:bg-background hover:text-foreground",
          (!configured || !activeProfile) && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full border border-foreground/15 bg-card text-foreground/70 transition group-hover:border-foreground/30 group-hover:text-foreground">
            <Plus className="size-3.5" />
          </span>
          {activeProfile ? "Add person" : "Choose profile first"}
        </span>
        <span className="hidden text-[0.6rem] uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 sm:inline">
          N
        </span>
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-2 rounded-2xl border bg-background/90 p-3 shadow-sm">
      <input
        autoFocus
        name="name"
        placeholder="Full name"
        className="h-10 w-full rounded-xl border-0 bg-transparent px-3 text-sm font-medium tracking-tight outline-none placeholder:text-muted-foreground/70 focus-visible:bg-card/60"
      />
      <ProfileAssignmentPicker
        profiles={profiles}
        selectedIds={selectedProfileIds}
        onChange={setSelectedProfileIds}
      />
      <textarea
        name="notes"
        placeholder="Care notes (optional)"
        rows={2}
        className="w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground/70 focus-visible:bg-card/60"
      />
      <div className="flex items-center justify-end gap-1 pt-1">
        <Button
          disabled={isPending}
          onClick={() => setOpen(false)}
          type="button"
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
        <Button disabled={isPending} type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
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
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: person.id });
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
  const overdueReaction = isReactionOverdue(latestReaction);

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-transparent bg-card ring-1 ring-inset shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset,0_18px_36px_-26px_oklch(0.2_0.028_264_/_0.18)] transition-all",
        tone.ring,
        "hover:-translate-y-0.5 hover:shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset,0_28px_52px_-26px_oklch(0.2_0.028_264_/_0.28)]",
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

      <div className="relative flex min-h-10 items-center px-3.5 pt-3">
        <button
          className="absolute left-2 top-3 cursor-grab rounded-md p-1 text-foreground/30 opacity-0 transition hover:bg-foreground/5 hover:text-foreground/70 group-hover:opacity-100 active:cursor-grabbing"
          type="button"
          aria-label={`Drag ${person.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
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
          <>
            <div className="flex -space-x-1.5">
              {assignedProfiles.slice(0, 3).map((profile) => (
                <ProfileAvatar key={profile.id} profile={profile} size="xs" />
              ))}
            </div>
            <span className="min-w-0 truncate text-[0.72rem] font-medium text-muted-foreground">
              {assignedProfiles.map((profile) => profile.name).join(", ")}
            </span>
          </>
        ) : (
          <span className="shrink-0 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Unassigned
          </span>
        )}
        <div className="flex min-w-0 items-center gap-1">
          {latestReaction ? (
            <>
              <span className="h-3.5 w-px shrink-0 bg-foreground/10" />
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
              <ContactReactionControls
                person={person}
                activeProfile={activeProfile}
                configured={configured}
                disabled={disabled}
                onNotice={onNotice}
                onReactionLogged={onReactionLogged}
                compact
              />
            </>
          ) : (
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
        "relative w-72 rotate-1 overflow-hidden rounded-2xl border border-transparent bg-card p-4 ring-1 ring-inset shadow-[0_30px_60px_-20px_oklch(0.2_0.028_264_/_0.35)]",
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
  const [activeDetailTab, setActiveDetailTab] = useState<"profiles" | "studies">("profiles");
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(person?.name ?? "");
  const [studySelection, setStudySelection] = useState<{
    studyNumber: number;
    focusKey: number;
  } | null>(null);
  const [assignmentFocusRequest, setAssignmentFocusRequest] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const assignmentSectionRef = useRef<HTMLDivElement>(null);
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
    });

    savedDetailNotesRef.current = notes;
    savedDetailProfileIdsRef.current = person.assigned_profile_ids;
    detailDraftRef.current = {
      notes,
      assignedProfileIds: person.assigned_profile_ids,
    };

    return () => window.cancelAnimationFrame(frame);
  }, [person]);

  useEffect(() => {
    if (assignmentFocusRequest === 0 || activeDetailTab !== "profiles") {
      return;
    }

    const focusAssignmentSection = () => {
      const assignmentSection = assignmentSectionRef.current;

      if (!assignmentSection) {
        return;
      }

      assignmentSection.scrollIntoView({ block: "nearest", behavior: "smooth" });
      assignmentSection.focus({ preventScroll: true });
    };

    const frame = window.requestAnimationFrame(focusAssignmentSection);
    const timeout = window.setTimeout(focusAssignmentSection, 240);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [activeDetailTab, assignmentFocusRequest]);

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

    setActiveDetailTab(deltaX > 0 ? "studies" : "profiles");
  }

  function handleStudyShortcut(studyNumber: number) {
    setStudySelection((current) => ({
      studyNumber,
      focusKey: (current?.focusKey ?? 0) + 1,
    }));
    setActiveDetailTab("studies");
  }

  function handleAssignClick() {
    setActiveDetailTab("profiles");
    setAssignmentFocusRequest((request) => request + 1);
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
            className="fixed inset-2 z-50 overflow-y-auto rounded-[1.75rem] border bg-card shadow-[0_50px_120px_-40px_oklch(0.2_0.028_264_/_0.45)] md:inset-y-4 md:left-auto md:right-4 md:w-[30rem] xl:w-[48rem]"
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
                <div className="flex min-w-0 items-start gap-3">
                  <ProfileAvatar profile={detailOwnerProfile} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      <span
                        className={cn("size-1.5 rounded-full", stageTones[person.stage].dot)}
                      />
                      <span>
                        {stageIndex[person.stage]} ·{" "}
                        {STAGES.find((s) => s.id === person.stage)?.label}
                      </span>
                      {detailOwnerProfile ? (
                        <>
                          <span className="text-foreground/25">/</span>
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{detailOwnerProfile.name}</span>
                            <button
                              type="button"
                              aria-label={`Assign ${person.name}`}
                              className="rounded-full border border-foreground/10 bg-background/55 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-foreground/75 transition hover:border-foreground/20 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                              onClick={handleAssignClick}
                              title="Assign profiles"
                            >
                              Assign
                            </button>
                          </span>
                        </>
                      ) : null}
                    </div>
                    {isNameEditing ? (
                      <input
                        ref={nameInputRef}
                        aria-label="Contact name"
                        className="w-full min-w-0 rounded-xl border border-foreground/10 bg-background/70 px-2 py-1 font-display text-4xl leading-[0.95] tracking-display text-foreground outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
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
                      <h2 className="font-display text-4xl leading-[0.95] tracking-display text-foreground">
                        <button
                          type="button"
                          aria-label={`Rename ${person.name}`}
                          className="-mx-1 rounded-xl px-1 text-left outline-none transition hover:bg-background/45 focus-visible:ring-2 focus-visible:ring-ring/20"
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
                <Button onClick={onClose} size="icon" type="button" variant="ghost">
                  <X className="size-5" />
                </Button>
              </div>

              <div className="space-y-5 p-6">
                <section
                  className="overflow-hidden rounded-2xl border bg-background/70 p-4"
                  onPointerDown={(event) => setSwipeStartX(event.clientX)}
                  onPointerUp={(event) => handleSwipeEnd(event.clientX)}
                  onPointerCancel={() => setSwipeStartX(null)}
                  onTouchStart={(event) => setSwipeStartX(event.touches[0]?.clientX ?? null)}
                  onTouchEnd={(event) => handleSwipeEnd(event.changedTouches[0]?.clientX ?? 0)}
                >
                  <div className="mb-4 flex justify-center">
                    <div className="flex rounded-full border border-foreground/10 bg-card p-1">
                      {[
                        ["profiles", "Assigned profiles"],
                        ["studies", "Bible studies"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setActiveDetailTab(value as "profiles" | "studies")}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] transition",
                            activeDetailTab === value
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {activeDetailTab === "profiles" ? (
                      <motion.div
                        key="profiles"
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 18 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      >
                        <div
                          ref={assignmentSectionRef}
                          className="space-y-3"
                          onFocus={() => {
                            if (selectedProfileIds.length === 0) {
                              setSelectedProfileIds(person.assigned_profile_ids);
                            }
                          }}
                          tabIndex={-1}
                        >
                          <ProfileAssignmentPicker
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
                            className="w-full resize-none rounded-xl border border-foreground/10 bg-card px-3 py-2 text-sm leading-5 outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
                          />
                        </div>
                      </motion.div>
                    ) : (
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
                          profiles={profiles}
                          activeProfile={activeProfile}
                          configured={configured}
                          onNotice={onNotice}
                          onStudyLogged={onStudyLogged}
                          selectedStudyNumber={studySelection?.studyNumber}
                          focusOnMount={studySelection !== null}
                          embedded
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
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
  const [isPending, startTransition] = useTransition();

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
      <div className="relative flex shrink-0 items-center gap-1">
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
        {selectedChannel ? (
          <div className="absolute right-0 top-8 z-20 flex overflow-hidden rounded-full border border-foreground/10 bg-card shadow-xl">
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
          </div>
        ) : null}
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
  profiles,
  activeProfile,
  configured,
  onNotice,
  onStudyLogged,
  selectedStudyNumber,
  focusOnMount = false,
  embedded = false,
}: {
  person: BoardPerson;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onStudyLogged: (
    personId: string,
    study: PersonStudy,
    event: PersonEvent
  ) => void;
  selectedStudyNumber?: number;
  focusOnMount?: boolean;
  embedded?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const initialStudyNumber = selectedStudyNumber ?? getNextStudyNumber(person.studies);
  const initialStudy = person.studies.find(
    (study) => study.study_number === initialStudyNumber
  );
  const [studyNumber, setStudyNumber] = useState(() =>
    initialStudyNumber
  );
  const [studyMonth, setStudyMonth] = useState(() =>
    getMonthValue(
      initialStudy?.studied_at ?? sortStudies(person.studies).at(-1)?.studied_at ?? person.created_at
    )
  );
  const [studyNotes, setStudyNotes] = useState(
    () => initialStudy?.notes ?? ""
  );
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const savedStudyNotesRef = useRef(initialStudy?.notes ?? "");
  const isSavingStudyRef = useRef(false);
  const copiedResetTimeoutRef = useRef<number | null>(null);
  const [studyTimelineCopied, setStudyTimelineCopied] = useState(false);
  const completedStudies = sortStudies(person.studies);
  const completedNumbers = new Set(
    completedStudies.map((study) => study.study_number)
  );

  async function copyStudyTimeline() {
    if (completedStudies.length === 0) {
      setStudyTimelineCopied(false);
      onNotice("No study timeline to copy yet.");
      return;
    }

    if (!navigator.clipboard) {
      setStudyTimelineCopied(false);
      onNotice("Clipboard is not available in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildStudyTimelineCopy(person, completedStudies, profiles)
      );
      setStudyTimelineCopied(true);

      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }

      copiedResetTimeoutRef.current = window.setTimeout(() => {
        setStudyTimelineCopied(false);
        copiedResetTimeoutRef.current = null;
      }, 1800);
    } catch {
      setStudyTimelineCopied(false);
      onNotice("The study timeline could not be copied.");
    }
  }

  function focusCareNotes() {
    window.requestAnimationFrame(() => {
      notesTextareaRef.current?.focus();
    });
  }

  function selectStudy(number: number, options: { focus?: boolean } = {}) {
    const completedStudy = person.studies.find((study) => study.study_number === number);

    setStudyNumber(number);

    if (completedStudy) {
      setStudyNotes(completedStudy.notes ?? "");
      savedStudyNotesRef.current = completedStudy.notes ?? "";

      const monthValue = getMonthValue(completedStudy.studied_at);

      if (monthValue) {
        setStudyMonth(monthValue);
      }
    } else {
      setStudyNotes("");
      savedStudyNotesRef.current = "";
    }

    if (options.focus) {
      focusCareNotes();
    }
  }

  useEffect(() => {
    if (!focusOnMount) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      notesTextareaRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusOnMount]);

  useEffect(() => {
    return () => {
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }
    };
  }, []);

  function saveStudy({
    nextStudyNumber = studyNumber,
    nextStudiedAt = `${studyMonth}-01`,
    nextNotes = studyNotes,
    force = false,
    refocus = false,
  }: {
    nextStudyNumber?: number;
    nextStudiedAt?: string;
    nextNotes?: string;
    force?: boolean;
    refocus?: boolean;
  } = {}) {
    if (!configured) {
      onNotice("Connect Supabase before logging studies.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before logging studies.");
      return;
    }

    if (!force && nextNotes.trim() === savedStudyNotesRef.current.trim()) {
      return;
    }

    if (isSavingStudyRef.current) {
      return;
    }

    isSavingStudyRef.current = true;

    startTransition(async () => {
      const result = await addPersonStudy({
        id: person.id,
        studyNumber: nextStudyNumber,
        studiedAt: nextStudiedAt,
        notes: nextNotes,
        actorProfileId: activeProfile.id,
      });

      isSavingStudyRef.current = false;

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The study could not be saved." : result.error);
        return;
      }

      onNotice(undefined);
      const loggedStudy = result.data.study;
      onStudyLogged(person.id, loggedStudy, result.data.event);
      setStudyNumber(loggedStudy.study_number);
      setStudyNotes(loggedStudy.notes ?? "");
      savedStudyNotesRef.current = loggedStudy.notes ?? "";

      const loggedMonth = getMonthValue(loggedStudy.studied_at);

      if (loggedMonth) {
        setStudyMonth(loggedMonth);
      }
      if (refocus) {
        focusCareNotes();
      }
    });
  }

  function handleSubmit(formData: FormData) {
    saveStudy({
      nextStudyNumber: Number(formData.get("studyNumber") ?? studyNumber),
      nextStudiedAt: String(formData.get("studiedAt") ?? ""),
      nextNotes: String(formData.get("notes") ?? ""),
      force: true,
      refocus: true,
    });
  }

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col",
        embedded
          ? "border-t border-foreground/[0.07] pt-4"
          : "rounded-2xl border bg-background/70 p-4"
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center rounded-full border border-foreground/10 bg-card p-0.5">
          <button
            aria-label="Previous study month"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
            onClick={() => setStudyMonth((current) => shiftMonth(current, -1))}
            type="button"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="min-w-20 px-1 text-center text-[0.68rem] font-medium uppercase tracking-[0.14em] text-foreground">
            {getMonthLabel(studyMonth)}
          </span>
          <button
            aria-label="Next study month"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
            onClick={() => setStudyMonth((current) => shiftMonth(current, 1))}
            type="button"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <span className="rounded-full border border-foreground/10 bg-background px-2.5 py-1 font-display text-lg leading-none tracking-display text-foreground">
          {completedStudies.length}
        </span>
        <button
          aria-label={studyTimelineCopied ? "Study timeline copied" : "Copy study timeline"}
          className={cn(
            "flex size-8 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
            studyTimelineCopied
              ? "border-blue-900 bg-blue-900 text-white hover:border-blue-950 hover:bg-blue-950 hover:text-white"
              : "border-foreground/10 bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
          )}
          onClick={copyStudyTimeline}
          type="button"
        >
          {studyTimelineCopied ? (
            <Check className="size-3.5" />
          ) : (
            <Share2 className="size-3.5" />
          )}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-10 gap-1.5">
        {Array.from({ length: TOTAL_STUDIES }, (_, index) => {
          const number = index + 1;
          const completed = completedNumbers.has(number);

          return (
            <button
              key={number}
              type="button"
              onClick={() => selectStudy(number, { focus: true })}
              className={cn(
                "h-7 rounded-lg border text-[0.62rem] font-medium tabular-nums transition",
                completed
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-foreground/10 bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                studyNumber === number && "ring-2 ring-ring/25 ring-offset-1 ring-offset-card"
              )}
              aria-label={`Study ${number}${completed ? " completed" : ""}`}
            >
              {number}
            </button>
          );
        })}
      </div>

      <form action={handleSubmit} className="mt-3 grid gap-2">
        <input name="studiedAt" type="hidden" value={`${studyMonth}-01`} />
        <div className="grid grid-cols-[5rem_auto] gap-2">
          <select
            name="studyNumber"
            value={studyNumber}
            onChange={(event) =>
              selectStudy(Number(event.target.value), { focus: true })
            }
            className="h-10 rounded-xl border border-foreground/10 bg-card px-2 text-sm font-medium tracking-tight outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
            aria-label="Study number"
          >
            {Array.from({ length: TOTAL_STUDIES }, (_, index) => index + 1).map(
              (number) => (
                <option key={number} value={number}>
                  #{number}
                </option>
              )
            )}
          </select>
          <Button disabled={isPending || !configured} type="submit" size="sm" className="h-10">
            <Send className="size-3.5" />
            Log
          </Button>
        </div>
        <label className="block overflow-hidden rounded-xl border border-foreground/10 bg-card transition focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/15">
          <span className="sr-only">Care notes</span>
          <textarea
            ref={notesTextareaRef}
            name="notes"
            rows={2}
            placeholder="Care notes for this study"
            value={studyNotes}
            onChange={(event) => setStudyNotes(event.target.value)}
            onBlur={(event) => {
              const nextFocus = event.relatedTarget;

              if (nextFocus instanceof Node && event.currentTarget.form?.contains(nextFocus)) {
                return;
              }

              saveStudy();
            }}
            className="min-h-20 w-full resize-none bg-transparent px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground/65"
          />
        </label>
      </form>

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
    <section className="rounded-2xl border bg-background/70 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <div className="flex rounded-full border border-foreground/10 bg-card p-1">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] transition",
              activeTab === "activity"
                ? "bg-foreground text-background"
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
                ? "bg-foreground text-background"
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
              className="flex h-9 w-full max-w-56 items-center gap-2 rounded-full border border-foreground/10 bg-card px-3 text-muted-foreground shadow-[0_10px_35px_-28px_oklch(0.2_0.028_264_/_0.45)] sm:w-56"
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
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-foreground/15 bg-background p-4 text-center text-[0.78rem] italic text-muted-foreground">
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
              <span
                aria-hidden
                className="absolute -left-[14px] top-3 size-2 rounded-full border-2 border-card bg-foreground/70"
              />
              <div className="rounded-xl border border-foreground/10 bg-card p-3">
                <div className="flex items-start gap-2.5">
                  <ProfileAvatar profile={actor ?? null} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.85rem] font-medium tracking-tight text-foreground">
                      {displayStageCopy(event.title)}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      {actor?.name ?? "System"} · {formatDate(event.created_at)}
                    </p>
                  </div>
                </div>
                {event.body ? (
                  <p className="mt-2 border-l-2 border-foreground/10 pl-3 text-[0.78rem] leading-5 text-muted-foreground">
                    {displayStageCopy(event.body)}
                  </p>
                ) : null}
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
      <p className="rounded-xl border border-dashed border-foreground/15 bg-background p-4 text-center text-[0.78rem] italic text-muted-foreground">
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
      <span
        aria-hidden
        className="absolute -left-[17px] top-2 flex size-4 items-center justify-center rounded-full border border-card bg-foreground text-[0.52rem] font-medium text-background"
      >
        {study.study_number}
      </span>
      <div className="rounded-xl border border-foreground/10 bg-card p-3">
        <div className="flex items-start gap-2.5">
          <ProfileAvatar profile={actor} size="xs" />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <form action={handleRename} className="flex min-w-0 items-center gap-1.5">
                <input
                  autoFocus
                  className="h-8 min-w-0 flex-1 rounded-lg border border-foreground/10 bg-background px-2 text-[0.82rem] font-medium tracking-tight outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
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
                <p className="min-w-0 max-w-32 shrink truncate text-[0.7rem] text-muted-foreground sm:max-w-40">
                  {actor?.name ?? "System"} · {formatDate(study.studied_at)}
                </p>
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

function ProfileAvatar({
  profile,
  size = "md",
}: {
  profile: BoardProfile | null;
  size?: "xs" | "sm" | "md";
}) {
  const sizeClass = {
    xs: "size-6 text-[0.62rem]",
    sm: "size-8 text-[0.7rem]",
    md: "size-10 text-sm",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/15 bg-card font-display tracking-display text-foreground/80 shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset]",
        sizeClass
      )}
      title={profile?.name ?? "No profile"}
    >
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          draggable={false}
          src={profile.avatar_url}
        />
      ) : (
        profile?.name.slice(0, 1).toUpperCase() ?? "·"
      )}
    </span>
  );
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
  profiles,
  selectedIds,
  onChange,
}: {
  profiles: BoardProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedProfiles = selectedIds
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter(Boolean) as BoardProfile[];
  const visibleProfiles = profiles.filter((profile) =>
    profile.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  function toggle(profileId: string) {
    const selected = selectedIds.includes(profileId);

    if (selected) {
      if (selectedIds.length === 1) {
        return;
      }

      onChange(selectedIds.filter((id) => id !== profileId));
      return;
    }

    if (selectedIds.length >= 3) {
      return;
    }

    onChange([...selectedIds, profileId]);
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-card/80 p-2.5">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => {
          const profile = selectedProfiles[index] ?? null;

          return (
            <button
              key={profile?.id ?? `empty-${index}`}
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border border-foreground/10 bg-background/70 px-2 py-2 text-center transition hover:border-foreground/25",
                profile && "bg-background"
              )}
            >
              {profile ? (
                <>
                  <ProfileAvatar profile={profile} size="sm" />
                  <span className="mt-1.5 max-w-full truncate text-[0.72rem] font-medium tracking-tight text-foreground">
                    {profile.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-foreground/20 text-muted-foreground">
                    <Plus className="size-3.5" />
                  </span>
                  <span className="mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Branch {index + 1}
                  </span>
                </>
              )}
            </button>
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
              className="relative z-10 flex max-h-[86vh] w-full max-w-lg flex-col rounded-t-[2rem] border bg-card p-4 shadow-2xl sm:rounded-[2rem]"
              initial={{ opacity: 0, y: 72, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 72, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Assign profiles"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Assign profiles
                  </p>
                  <h3 className="mt-1.5 font-display text-3xl leading-[0.95] tracking-display">
                    Choose 1 to 3 people
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Search the registered profiles and tap to assign or remove.
                  </p>
                </div>
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
                  className="h-11 w-full rounded-2xl border bg-background pl-11 pr-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                />
              </label>

              <ProfileStack profiles={selectedProfiles} className="mt-3 rounded-2xl bg-background p-3" />

              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {visibleProfiles.length > 0 ? (
                  visibleProfiles.map((profile) => {
                    const selected = selectedIds.includes(profile.id);
                    const disabled = !selected && selectedIds.length >= 3;

                    return (
                      <button
                        key={profile.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border bg-background p-3 text-left transition",
                          selected && "border-primary bg-primary/10",
                          disabled && "cursor-not-allowed opacity-45"
                        )}
                        disabled={disabled}
                        onClick={() => toggle(profile.id)}
                        type="button"
                      >
                        <ProfileAvatar profile={profile} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black">
                            {profile.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {profile.active_contacts} active contacts
                          </span>
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em]",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {selected ? "Selected" : "Add"}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
                    No profiles match that search.
                  </p>
                )}
              </div>

              <Button
                className="mt-4 w-full"
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
