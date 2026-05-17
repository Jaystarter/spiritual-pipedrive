"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
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
  Archive,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  MessageCircle,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";

import {
  addPersonNote,
  archivePerson,
  createPerson,
  movePerson,
  updatePerson,
  type BoardProfile,
  type BoardPerson,
  type PersonEvent,
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
  stripe: string;
  glow: string;
};

const stageTones: Record<StageId, StageTone> = {
  hunting: {
    text: "text-amber-900",
    soft: "bg-amber-50 text-amber-950",
    ring: "ring-amber-200/60",
    dot: "bg-amber-500",
    stripe: "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600",
    glow: "from-amber-200/45 via-amber-100/0 to-transparent",
  },
  first_bible_study: {
    text: "text-slate-700",
    soft: "bg-slate-100 text-slate-900",
    ring: "ring-slate-200/70",
    dot: "bg-slate-500",
    stripe: "bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600",
    glow: "from-slate-200/35 via-slate-100/0 to-transparent",
  },
  third_bible_study: {
    text: "text-indigo-800",
    soft: "bg-indigo-50 text-indigo-950",
    ring: "ring-indigo-200/65",
    dot: "bg-indigo-500",
    stripe: "bg-gradient-to-b from-indigo-300 via-indigo-500 to-indigo-700",
    glow: "from-indigo-200/40 via-indigo-100/0 to-transparent",
  },
  seventh_bible_study: {
    text: "text-violet-800",
    soft: "bg-violet-50 text-violet-950",
    ring: "ring-violet-200/65",
    dot: "bg-violet-500",
    stripe: "bg-gradient-to-b from-violet-300 via-violet-500 to-violet-700",
    glow: "from-violet-200/40 via-violet-100/0 to-transparent",
  },
  ready_for_baptism: {
    text: "text-emerald-800",
    soft: "bg-emerald-50 text-emerald-950",
    ring: "ring-emerald-200/60",
    dot: "bg-emerald-500",
    stripe: "bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700",
    glow: "from-emerald-200/40 via-emerald-100/0 to-transparent",
  },
  baptized: {
    text: "text-yellow-800",
    soft: "bg-yellow-50 text-yellow-950",
    ring: "ring-yellow-200/65",
    dot: "bg-yellow-500",
    stripe: "bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600",
    glow: "from-yellow-200/45 via-yellow-100/0 to-transparent",
  },
};

const emptyMessages: Record<StageId, string> = {
  hunting: "Start with someone you are praying for or inviting.",
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

  const totalActive = people.filter((person) => person.stage !== "baptized").length;
  const baptizedThisMonth = people.filter((person) => person.stage === "baptized").length;
  const readyCount = people.filter((person) => person.stage === "ready_for_baptism").length;
  const needsTeacher = people.filter((person) => person.assigned_profile_ids.length === 0).length;
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
        item.id === person.id ? { ...person, events: item.events } : item
      )
    );
  }

  function handleArchived(id: string) {
    setPeople((current) => current.filter((person) => person.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  function handleEventAdded(personId: string, event: PersonEvent) {
    setPeople((current) =>
      current.map((person) =>
        person.id === personId
          ? { ...person, events: [event, ...person.events] }
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
          totalActive={totalActive}
          baptizedThisMonth={baptizedThisMonth}
          readyCount={readyCount}
          needsTeacher={needsTeacher}
          profiles={profiles}
          activeProfile={activeProfile}
          profileFilter={profileFilter}
          onProfileFilterChange={setProfileFilter}
          onOpenProfiles={() => setProfileSheetOpen(true)}
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
            onArchived={handleArchived}
            onMove={moveWithButtons}
            onNotice={setNotice}
            onSelect={setSelectedId}
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
        onArchived={handleArchived}
        onMove={moveWithButtons}
        onNotice={setNotice}
        onEventAdded={handleEventAdded}
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
  totalActive,
  baptizedThisMonth,
  readyCount,
  needsTeacher,
  profiles,
  activeProfile,
  profileFilter,
  onProfileFilterChange,
  onOpenProfiles,
  configured,
  notice,
}: {
  search: string;
  onSearch: (value: string) => void;
  totalActive: number;
  baptizedThisMonth: number;
  readyCount: number;
  needsTeacher: number;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  profileFilter: string;
  onProfileFilterChange: (value: string) => void;
  onOpenProfiles: () => void;
  configured: boolean;
  notice?: string;
}) {
  const compactStats = [
    { label: "Active", value: totalActive, hint: "in pipeline" },
    { label: "Ready", value: readyCount, hint: "for baptism" },
    { label: "Baptized", value: baptizedThisMonth, hint: "this month" },
    { label: "Unassigned", value: needsTeacher, hint: "needs owner" },
  ];

  const today = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="relative">
      <div className="flex items-end justify-between gap-4 pb-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl italic leading-none text-foreground sm:text-4xl">
            Pipeline
          </span>
          <span className="hidden h-1.5 w-1.5 rounded-full bg-accent sm:inline-block" />
          <span className="hidden text-[0.7rem] font-medium uppercase tracking-[0.28em] text-muted-foreground sm:inline">
            Bible Study CRM
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[0.66rem] font-medium uppercase tracking-[0.24em] text-muted-foreground md:inline">
            {today}
          </span>
          <span className="hidden h-3 w-px bg-foreground/15 md:inline-block" />
          <span className="inline-flex items-center gap-1.5 text-[0.66rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                configured ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
            {configured ? "Live" : "Setup needed"}
          </span>
        </div>
      </div>

      <div className="rounded-3xl border bg-card/85 shadow-[0_1px_0_oklch(1_0_0_/_0.4)_inset,0_24px_60px_-30px_oklch(0.2_0.028_264_/_0.18)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 p-3 md:flex-row md:items-stretch md:gap-0 md:p-2">
          {/* Profile pill */}
          <button
            type="button"
            onClick={onOpenProfiles}
            className="group relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-background/70 md:rounded-l-2xl md:rounded-r-none md:pr-4"
          >
            <ProfileAvatar profile={activeProfile} size="sm" />
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.6rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Acting as
              </span>
              <span className="max-w-[10rem] truncate text-sm font-semibold tracking-tight">
                {activeProfile ? activeProfile.name : "Choose profile"}
              </span>
            </span>
            <span className="ml-auto hidden h-9 items-center justify-center rounded-xl border border-transparent px-2 text-muted-foreground transition group-hover:border-foreground/10 group-hover:text-foreground md:inline-flex">
              <Users className="size-3.5" />
            </span>
          </button>

          <span className="hidden w-px self-stretch bg-foreground/10 md:block" />

          {/* Search */}
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
            <span className="sr-only">Search people</span>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search by name, owner, or note"
              className="h-12 w-full rounded-2xl border-0 bg-transparent px-3 pl-11 text-sm font-medium tracking-tight outline-none placeholder:font-normal placeholder:text-muted-foreground/70 focus-visible:bg-background/60 md:rounded-none"
            />
          </label>

          <span className="hidden w-px self-stretch bg-foreground/10 md:block" />

          {/* Filter */}
          <div className="relative flex items-center md:rounded-r-2xl">
            <select
              value={profileFilter}
              onChange={(event) => onProfileFilterChange(event.target.value)}
              className="h-12 w-full appearance-none rounded-2xl border-0 bg-transparent px-4 pr-9 text-sm font-medium tracking-tight outline-none focus-visible:bg-background/60 md:rounded-none md:rounded-r-2xl md:min-w-[11rem]"
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
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-px border-t border-foreground/10 bg-foreground/[0.06] sm:grid-cols-4">
          {compactStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-baseline justify-between gap-3 bg-card/80 px-4 py-3 transition first:rounded-bl-3xl last:rounded-br-3xl sm:flex-col sm:items-start sm:justify-start sm:gap-1"
            >
              <span className="font-display text-3xl leading-none tracking-display text-foreground">
                {stat.value}
              </span>
              <span className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {stat.label} <span className="opacity-60">· {stat.hint}</span>
              </span>
            </div>
          ))}
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
  onArchived,
  onMove,
  onNotice,
  onSelect,
}: {
  people: BoardPerson[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  isPending: boolean;
  onCreated: (person: BoardPerson) => void;
  onArchived: (id: string) => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
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
                onArchived={onArchived}
                onMove={onMove}
                onNotice={onNotice}
                onSelect={onSelect}
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
  onArchived,
  onMove,
  onNotice,
  onSelect,
}: {
  stage: (typeof STAGES)[number];
  people: BoardPerson[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  isPending: boolean;
  onCreated: (person: BoardPerson) => void;
  onArchived: (id: string) => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const tone = stageTones[stage.id];

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "group/lane relative flex h-full min-h-[42rem] w-[82vw] max-w-[22rem] flex-col overflow-hidden rounded-[1.6rem] border bg-card/82 shadow-[0_1px_0_oklch(1_0_0_/_0.5)_inset,0_30px_60px_-32px_oklch(0.2_0.028_264_/_0.16)] transition-all md:w-auto md:max-w-none",
        isOver && "ring-2 ring-foreground/15 ring-offset-2 ring-offset-background"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-90",
          tone.glow
        )}
      />
      <div className="relative flex items-start justify-between gap-4 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl italic leading-none text-foreground/40">
              {stageIndex[stage.id]}
            </span>
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", tone.dot)} />
          </div>
          <h2 className="mt-2 font-display text-2xl leading-[0.95] tracking-display text-foreground">
            {stage.label}
          </h2>
          <p className="mt-2 min-h-9 max-w-[14rem] text-[0.74rem] leading-5 text-muted-foreground">
            {stage.description}
          </p>
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
          <span className="text-[0.58rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {people.length === 1 ? "Person" : "People"}
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
                onArchived={onArchived}
                onMove={onMove}
                onNotice={onNotice}
                onSelect={onSelect}
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
  onArchived,
  onMove,
  onNotice,
  onSelect,
}: {
  person: BoardPerson;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  disabled?: boolean;
  onArchived: (id: string) => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onSelect: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
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

  function handleArchive() {
    if (!configured) {
      onNotice("Connect Supabase before archiving people.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before archiving people.");
      return;
    }

    startTransition(async () => {
      const result = await archivePerson(person.id, activeProfile.id);

      if (!result.ok) {
        onNotice(result.error);
        return;
      }

      onNotice(undefined);
      onArchived(person.id);
    });
  }

  const tone = stageTones[person.stage];
  const assignedProfiles = getAssignedProfiles(person, profiles);
  const hasFollowUp = Boolean(person.next_follow_up_at);

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset,0_18px_36px_-26px_oklch(0.2_0.028_264_/_0.18)] transition-all",
        "hover:-translate-y-0.5 hover:shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset,0_28px_52px_-26px_oklch(0.2_0.028_264_/_0.28)]",
        isDragging && "opacity-40"
      )}
      whileTap={{ scale: 0.99 }}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px]",
          tone.stripe
        )}
      />

      <div className="flex items-start gap-2 pl-3.5 pr-2.5 pt-3">
        <button
          className="-ml-1 mt-0.5 cursor-grab rounded-md p-1 text-foreground/30 opacity-0 transition hover:bg-foreground/5 hover:text-foreground/70 group-hover:opacity-100 active:cursor-grabbing"
          type="button"
          aria-label={`Drag ${person.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          className="-ml-1 min-w-0 flex-1 text-left"
          type="button"
          onClick={() => onSelect(person.id)}
        >
          <h3 className="truncate font-display text-lg leading-[1.05] tracking-display text-foreground transition group-hover:text-foreground">
            {person.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <span className={cn("inline-block size-1 rounded-full", tone.dot)} />
            <span className="truncate normal-case tracking-normal">
              {profileNames(person, profiles)}
            </span>
          </p>
        </button>
        {hasFollowUp ? (
          <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[0.6rem] font-medium tracking-[0.12em] text-foreground/70">
            {formatDate(person.next_follow_up_at)}
          </span>
        ) : null}
      </div>

      {person.notes ? (
        <p className="mx-3.5 mt-3 line-clamp-2 border-l-2 border-foreground/10 pl-3 text-[0.78rem] leading-5 text-muted-foreground">
          {person.notes}
        </p>
      ) : null}

      {person.stage === "baptized" && person.baptized_at ? (
        <p className="mx-3.5 mt-3 text-[0.62rem] font-medium uppercase tracking-[0.2em] text-amber-700">
          Baptized {new Date(person.baptized_at).toLocaleDateString()}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-foreground/[0.07] bg-foreground/[0.015] px-3 py-2">
        <div className="flex -space-x-1.5">
          {assignedProfiles.length > 0 ? (
            assignedProfiles.slice(0, 3).map((profile) => (
              <ProfileAvatar key={profile.id} profile={profile} size="xs" />
            ))
          ) : (
            <span className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Unassigned
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            aria-label={`Move ${person.name} backward`}
            disabled={!configured || disabled || !previousStage}
            onClick={() => previousStage && onMove(person, previousStage)}
            size="icon-sm"
            type="button"
            variant="ghost"
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
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <span className="mx-1 h-3.5 w-px bg-foreground/10" />
          <Button
            disabled={!configured || disabled || isPending}
            onClick={() => onSelect(person.id)}
            size="sm"
            type="button"
            variant="ghost"
            className="h-7 px-2 text-[0.7rem] font-medium tracking-tight"
          >
            Open
          </Button>
          <Button
            aria-label={`Archive ${person.name}`}
            disabled={!configured || disabled || isPending}
            onClick={handleArchive}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Archive className="size-3.5" />
          </Button>
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
    <article className="relative w-72 rotate-1 overflow-hidden rounded-2xl border bg-card p-4 shadow-[0_30px_60px_-20px_oklch(0.2_0.028_264_/_0.35)]">
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-y-0 left-0 w-[3px]", tone.stripe)}
      />
      <p className="font-display text-xl leading-[1.05] tracking-display">{person.name}</p>
      <p className="mt-1.5 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {profileNames(person, profiles)}
      </p>
      <ProfileStack profiles={getAssignedProfiles(person, profiles)} className="mt-3" />
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
  onArchived,
  onMove,
  onNotice,
  onEventAdded,
}: {
  person: BoardPerson | null;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  onClose: () => void;
  onUpdated: (person: BoardPerson) => void;
  onArchived: (id: string) => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
  onEventAdded: (personId: string, event: PersonEvent) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  function handleSubmit(formData: FormData) {
    if (!person) {
      return;
    }

    if (!configured) {
      onNotice("Connect Supabase before editing people.");
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before editing people.");
      return;
    }

    startTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? ""),
        assignedProfileIds:
          selectedProfileIds.length > 0 ? selectedProfileIds : person.assigned_profile_ids,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The person could not be updated." : result.error);
        return;
      }

      onNotice(undefined);
      onUpdated(result.data);
    });
  }

  function handleArchive() {
    if (!person) {
      return;
    }

    if (!activeProfile) {
      onNotice("Choose your profile before archiving people.");
      return;
    }

    startTransition(async () => {
      const result = await archivePerson(person.id, activeProfile.id);

      if (!result.ok) {
        onNotice(result.error);
        return;
      }

      onArchived(person.id);
    });
  }

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
            className="fixed inset-2 z-50 overflow-y-auto rounded-[1.75rem] border bg-card shadow-[0_50px_120px_-40px_oklch(0.2_0.028_264_/_0.45)] md:inset-y-4 md:left-auto md:right-4 md:w-[30rem]"
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", stageTones[person.stage].dot)} />
                    {stageIndex[person.stage]} · {STAGES.find((s) => s.id === person.stage)?.label}
                  </div>
                  <h2 className="mt-3 font-display text-4xl leading-[0.95] tracking-display text-foreground">
                    {person.name}
                  </h2>
                  <p className="mt-2 text-[0.78rem] leading-5 text-muted-foreground">
                    {profileNames(person, profiles)}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Follow-up</span>
                    <span className="h-3 w-px bg-foreground/15" />
                    <span className="text-foreground/80 normal-case tracking-tight">
                      {formatDate(person.next_follow_up_at)}
                    </span>
                  </div>
                  <ProfileStack profiles={getAssignedProfiles(person, profiles)} className="mt-4" />
                </div>
                <Button onClick={onClose} size="icon" type="button" variant="ghost">
                  <X className="size-5" />
                </Button>
              </div>

              <div className="space-y-5 p-6">
                <QuickMove
                  person={person}
                  onMove={onMove}
                  configured={configured}
                  activeProfile={activeProfile}
                  onNotice={onNotice}
                />

                <form
                  action={handleSubmit}
                  className="space-y-3 rounded-2xl border bg-background/70 p-4"
                  onFocus={() => {
                    if (selectedProfileIds.length === 0) {
                      setSelectedProfileIds(person.assigned_profile_ids);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      Contact details
                    </p>
                  </div>
                  <input
                    name="name"
                    defaultValue={person.name}
                    className="h-11 w-full rounded-xl border border-foreground/10 bg-card px-3 text-sm tracking-tight outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
                  />
                  <ProfileAssignmentPicker
                    profiles={profiles}
                    selectedIds={
                      selectedProfileIds.length > 0
                        ? selectedProfileIds
                        : person.assigned_profile_ids
                    }
                    onChange={setSelectedProfileIds}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="phone"
                      defaultValue={person.phone ?? ""}
                      placeholder="Phone"
                      className="h-11 w-full rounded-xl border border-foreground/10 bg-card px-3 text-sm tracking-tight outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
                    />
                    <input
                      name="nextFollowUpAt"
                      defaultValue={person.next_follow_up_at?.slice(0, 10) ?? ""}
                      type="date"
                      className="h-11 w-full rounded-xl border border-foreground/10 bg-card px-3 text-sm tracking-tight outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
                    />
                  </div>
                  <textarea
                    name="notes"
                    defaultValue={person.notes ?? ""}
                    rows={4}
                    placeholder="Care notes"
                    className="w-full resize-none rounded-xl border border-foreground/10 bg-card px-3 py-2 text-sm leading-5 outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
                  />
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      disabled={isPending || !configured}
                      onClick={handleArchive}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Archive className="size-3.5" />
                      Archive
                    </Button>
                    <Button disabled={isPending || !configured} type="submit" size="sm">
                      Save changes
                    </Button>
                  </div>
                </form>

                <AddNoteCard
                  person={person}
                  activeProfile={activeProfile}
                  configured={configured}
                  onNotice={onNotice}
                  onEventAdded={onEventAdded}
                />
                <ActivityTimeline events={person.events} profiles={profiles} />
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function QuickMove({
  person,
  configured,
  activeProfile,
  onMove,
  onNotice,
}: {
  person: BoardPerson;
  configured: boolean;
  activeProfile: BoardProfile | null;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
}) {
  const previousStage = getNextStage(person.stage, -1);
  const nextStage = getNextStage(person.stage, 1);

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-foreground/10 bg-background/70 p-1.5">
      <Button
        disabled={!configured || !previousStage || !activeProfile}
        onClick={() => {
          if (!activeProfile) {
            onNotice("Choose your profile before moving people.");
            return;
          }

          if (previousStage) {
            onMove(person, previousStage);
          }
        }}
        type="button"
        variant="ghost"
        size="sm"
        className="flex-1 text-[0.72rem] font-medium tracking-tight"
      >
        <ChevronLeft className="size-3.5" />
        Back
      </Button>
      <span className="h-5 w-px bg-foreground/10" />
      <Button
        disabled={!configured || !nextStage || !activeProfile}
        onClick={() => {
          if (!activeProfile) {
            onNotice("Choose your profile before moving people.");
            return;
          }

          if (nextStage) {
            onMove(person, nextStage);
          }
        }}
        type="button"
        size="sm"
        className="flex-1 text-[0.72rem] font-medium tracking-tight"
      >
        Next stage
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

function AddNoteCard({
  person,
  activeProfile,
  configured,
  onNotice,
  onEventAdded,
}: {
  person: BoardPerson;
  activeProfile: BoardProfile | null;
  configured: boolean;
  onNotice: (message?: string) => void;
  onEventAdded: (personId: string, event: PersonEvent) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    if (!activeProfile) {
      onNotice("Choose your profile before adding notes.");
      return;
    }

    startTransition(async () => {
      const result = await addPersonNote({
        id: person.id,
        body: String(formData.get("body") ?? ""),
        nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? ""),
        markContacted: formData.get("markContacted") === "on",
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The note could not be saved." : result.error);
        return;
      }

      onNotice(undefined);
      onEventAdded(person.id, result.data);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3 rounded-2xl border bg-background/70 p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-3.5 text-foreground/60" />
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Add care note
        </p>
      </div>
      <textarea
        name="body"
        rows={3}
        placeholder="What happened? What needs prayer or follow-up?"
        className="w-full resize-none rounded-xl border border-foreground/10 bg-card px-3 py-2 text-sm leading-5 outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          name="nextFollowUpAt"
          type="date"
          className="h-10 rounded-xl border border-foreground/10 bg-card px-3 text-sm tracking-tight outline-none transition focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/15"
        />
        <label className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-card px-3 text-[0.7rem] font-medium tracking-tight text-foreground/80">
          <input name="markContacted" type="checkbox" className="accent-foreground" />
          Contacted
        </label>
      </div>
      <Button disabled={isPending || !configured} type="submit" className="w-full">
        <Send className="size-3.5" />
        Save note
      </Button>
    </form>
  );
}

function ActivityTimeline({
  events,
  profiles,
}: {
  events: PersonEvent[];
  profiles: BoardProfile[];
}) {
  return (
    <section className="rounded-2xl border bg-background/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Activity timeline
        </p>
        <Clock3 className="size-3.5 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        {events.length > 0 ? (
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
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                            {actor?.name ?? "System"} ·{" "}
                            {formatDate(event.created_at)}
                          </p>
                        </div>
                      </div>
                      {event.body ? (
                        <p className="mt-2 border-l-2 border-foreground/10 pl-3 text-[0.78rem] leading-5 text-muted-foreground">
                          {event.body}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-foreground/15 bg-background p-4 text-center text-[0.78rem] italic text-muted-foreground">
            Notes, moves, and updates will appear here.
          </p>
        )}
      </div>
    </section>
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="px-1 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Assigned · {selectedIds.length}/3
          </p>
          <ProfileStack profiles={selectedProfiles} className="mt-1.5" />
        </div>
        <Button onClick={() => setOpen(true)} type="button" variant="outline" size="sm">
          Assign
        </Button>
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
