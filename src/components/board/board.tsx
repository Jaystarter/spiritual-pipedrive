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
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  GripVertical,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  UserRound,
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

const toneClasses: Record<string, string> = {
  amber: "border-amber-300/80 bg-amber-200/80 text-amber-950",
  sky: "border-cyan-300/80 bg-cyan-200/80 text-cyan-950",
  indigo: "border-blue-300/80 bg-blue-200/80 text-blue-950",
  violet: "border-fuchsia-300/80 bg-fuchsia-200/80 text-fuchsia-950",
  emerald: "border-emerald-300/80 bg-emerald-200/80 text-emerald-950",
  green: "border-lime-300/80 bg-lime-200/80 text-lime-950",
};

const stageAccentClasses: Record<StageId, string> = {
  hunting: "from-amber-400 to-orange-500",
  first_bible_study: "from-cyan-400 to-sky-500",
  third_bible_study: "from-blue-400 to-indigo-500",
  seventh_bible_study: "from-fuchsia-400 to-violet-500",
  ready_for_baptism: "from-emerald-400 to-teal-500",
  baptized: "from-lime-300 to-green-500",
};

const emptyMessages: Record<StageId, string> = {
  hunting: "Start with someone you are praying for or inviting.",
  first_bible_study: "Schedule the first open-Bible conversation.",
  third_bible_study: "Move consistent early studies here.",
  seventh_bible_study: "Track steady studies that need continued care.",
  ready_for_baptism: "Keep final preparation visible and personal.",
  baptized: "This month’s baptisms will glow here.",
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
  const nextBestAction = useMemo(() => {
    const ready = people.find((person) => person.stage === "ready_for_baptism");
    const unassigned = people.find((person) => !person.teacher);
    const needsFollowUp = people.find((person) => Boolean(person.next_follow_up_at));

    return ready ?? needsFollowUp ?? unassigned ?? people[0] ?? null;
  }, [people]);

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
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,oklch(0.84_0.19_40_/_0.36),transparent_28%),radial-gradient(circle_at_90%_0%,oklch(0.78_0.16_205_/_0.28),transparent_30%),linear-gradient(135deg,var(--background),var(--muted))]" />
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-3 py-3 sm:px-5 sm:py-5">
        <AppShellHeader
          search={search}
          onSearch={setSearch}
          totalActive={totalActive}
          baptizedThisMonth={baptizedThisMonth}
          readyCount={readyCount}
          needsTeacher={needsTeacher}
          nextBestAction={nextBestAction}
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
  nextBestAction,
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
  nextBestAction: BoardPerson | null;
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  profileFilter: string;
  onProfileFilterChange: (value: string) => void;
  onOpenProfiles: () => void;
  configured: boolean;
  notice?: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[1.5rem] border bg-card/90 p-3 shadow-xl shadow-primary/10 backdrop-blur sm:p-4">
      <div className="absolute -right-16 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative grid gap-4 xl:grid-cols-[0.9fr_1.1fr] xl:items-end">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Bible Study Pipeline
          </div>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-black tracking-[-0.05em] text-foreground sm:text-4xl xl:text-5xl">
              Shepherd every study with momentum.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              A bold journey board for tracking who is hunting, studying,
              preparing, and celebrating baptism this month.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onOpenProfiles}
              className="flex h-11 items-center gap-3 rounded-2xl border bg-background/90 px-3 text-left text-sm font-bold shadow-sm transition hover:bg-card"
            >
              <ProfileAvatar profile={activeProfile} size="sm" />
              <span className="min-w-0 flex-1 truncate">
                {activeProfile ? activeProfile.name : "Choose profile"}
              </span>
              <Users className="size-4 text-muted-foreground" />
            </button>
            <select
              value={profileFilter}
              onChange={(event) => onProfileFilterChange(event.target.value)}
              className="h-11 min-w-44 rounded-2xl border bg-background/90 px-3 text-sm font-bold shadow-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
            >
              <option value="all">All contacts</option>
              <option value="mine">My contacts</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Search people</span>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search names, teachers, notes"
            className="h-11 w-full rounded-2xl border bg-background/90 pl-11 pr-4 text-sm font-medium shadow-inner outline-none transition focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Active" value={totalActive} icon={Flame} />
            <StatTile label="Baptized" value={baptizedThisMonth} icon={BookOpen} />
            <StatTile label="Ready" value={readyCount} icon={ArrowUpRight} />
            <StatTile label="Need teacher" value={needsTeacher} icon={UserRound} />
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid gap-2 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Next best action
          </p>
          {nextBestAction ? (
            <button
              className="mt-2 flex w-full items-center justify-between gap-3 text-left"
              type="button"
            >
              <span>
                <span className="block text-lg font-black">{nextBestAction.name}</span>
                <span className="text-sm text-muted-foreground">
                  {profileNames(nextBestAction, profiles)} ·{" "}
                  {formatDate(nextBestAction.next_follow_up_at)}
                </span>
              </span>
              <ArrowUpRight className="size-5 text-primary" />
            </button>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Add the first person to begin the journey.
            </p>
          )}
        </div>
        <div className="rounded-2xl border bg-foreground p-3 text-background">
          <p className="text-xs font-semibold leading-5 opacity-75 sm:text-sm">
            Today’s rhythm: contact one new person, move one active study, and
            write one care note.
          </p>
        </div>
      </div>

      {!configured ? (
        <p className="relative mt-4 rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950">
          Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel to enable saving.
        </p>
      ) : null}
      {notice ? (
        <p className="relative mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {notice}
        </p>
      ) : null}
    </header>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Flame;
}) {
  return (
    <div className="rounded-2xl border bg-background/80 p-2.5 shadow-sm">
      <Icon className="mb-2 size-3.5 text-primary" />
      <p className="text-xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[0.7rem] font-semibold text-muted-foreground">{label}</p>
    </div>
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
    <div className="mt-4 overflow-x-auto pb-2">
      <div className="grid min-h-[42rem] w-max grid-cols-6 gap-3 md:min-w-[1180px] xl:w-full">
        {STAGES.map((stage, index) => {
          const stagePeople = sortPeople(
            people.filter((person) => person.stage === stage.id)
          );

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.45, ease: "easeOut" }}
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

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-[42rem] w-[82vw] max-w-[22rem] flex-col overflow-hidden rounded-[1.7rem] border bg-card/82 shadow-xl shadow-primary/5 transition-colors backdrop-blur md:w-auto md:max-w-none",
        isOver && "border-primary/60 bg-primary/10"
      )}
    >
      <div
        className={cn(
          "h-2 bg-gradient-to-r",
          stageAccentClasses[stage.id]
        )}
      />
      <div className="space-y-4 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted-foreground">
              {stage.shortLabel}
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">{stage.label}</h2>
            <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
              {stage.description}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              toneClasses[stage.tone]
            )}
          >
            {people.length}
          </span>
        </div>
        <AddPersonForm
          stage={stage.id}
          profiles={profiles}
          activeProfile={activeProfile}
          configured={configured}
          onCreated={onCreated}
          onNotice={onNotice}
        />
      </div>

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
            <div className="flex min-h-40 flex-col items-center justify-center rounded-[1.4rem] border border-dashed bg-background/70 p-5 text-center">
              <div className={cn("mb-4 size-12 rounded-2xl bg-gradient-to-br", stageAccentClasses[stage.id])} />
              <p className="text-sm font-bold">{emptyMessages[stage.id]}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Add a card or drag someone into this stage.
              </p>
            </div>
          ) : null}
        </div>
      </SortableContext>
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
      <Button
        className="h-12 w-full justify-start rounded-2xl text-sm font-bold"
        disabled={!configured || !activeProfile}
        onClick={() => {
          setSelectedProfileIds(activeProfile ? [activeProfile.id] : []);
          setOpen(true);
        }}
        type="button"
        variant="outline"
      >
        <Plus className="size-4" />
        {activeProfile ? "Add person" : "Choose profile first"}
      </Button>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-2 rounded-3xl border bg-background p-3">
      <input
        autoFocus
        name="name"
        placeholder="Name"
        className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <ProfileAssignmentPicker
        profiles={profiles}
        selectedIds={selectedProfileIds}
        onChange={setSelectedProfileIds}
      />
      <textarea
        name="notes"
        placeholder="Notes"
        rows={3}
        className="w-full resize-none rounded-xl border bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <div className="flex gap-2 pt-1">
        <Button disabled={isPending} type="submit">
          Save
        </Button>
        <Button
          disabled={isPending}
          onClick={() => setOpen(false)}
          type="button"
          variant="ghost"
        >
          Cancel
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

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-[1.35rem] border bg-background p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl",
        isDragging && "opacity-35"
      )}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab rounded-lg p-1 text-muted-foreground transition hover:bg-muted active:cursor-grabbing"
          type="button"
          aria-label={`Drag ${person.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <button
            className="block max-w-full truncate text-left text-base font-black hover:text-primary"
            type="button"
            onClick={() => onSelect(person.id)}
          >
            {person.name}
          </button>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5" />
            {profileNames(person, profiles)}
          </p>
        </div>
      </div>

      {person.notes ? (
        <p className="mt-3 line-clamp-3 rounded-2xl bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {person.notes}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="rounded-xl bg-card px-2 py-1.5">
          {person.phone || "No phone"}
        </span>
        <span className="rounded-xl bg-card px-2 py-1.5">
          Follow {formatDate(person.next_follow_up_at)}
        </span>
        {person.stage === "baptized" && person.baptized_at ? (
          <span>{new Date(person.baptized_at).toLocaleDateString()}</span>
        ) : null}
      </div>
      <ProfileStack profiles={getAssignedProfiles(person, profiles)} className="mt-3" />

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex gap-1">
          <Button
            aria-label={`Move ${person.name} backward`}
            disabled={!configured || disabled || !previousStage}
            onClick={() => previousStage && onMove(person, previousStage)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label={`Move ${person.name} forward`}
            disabled={!configured || disabled || !nextStage}
            onClick={() => nextStage && onMove(person, nextStage)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button
            disabled={!configured || disabled || isPending}
            onClick={() => onSelect(person.id)}
            size="sm"
            type="button"
            variant="ghost"
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
            <Archive className="size-4" />
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
  return (
    <article className="w-72 rotate-2 rounded-[1.5rem] border bg-background p-4 shadow-2xl">
      <p className="text-lg font-black">{person.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">
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
            className="fixed inset-2 z-50 overflow-y-auto rounded-[2rem] border bg-card shadow-2xl md:inset-y-4 md:left-auto md:right-4 md:w-[28rem]"
            initial={{ opacity: 0, y: 80, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className={cn("h-3 bg-gradient-to-r", stageAccentClasses[person.stage])} />
            <div className="flex min-h-[calc(100%-0.75rem)] flex-col">
              <div className="flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {formatDate(person.next_follow_up_at)} follow-up
                  </p>
                  <h2 className="mt-1 text-3xl font-black tracking-tight">
                    {person.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profileNames(person, profiles)} · {person.phone || "No phone"}
                  </p>
                  <ProfileStack profiles={getAssignedProfiles(person, profiles)} className="mt-3" />
                </div>
                <Button onClick={onClose} size="icon" type="button" variant="ghost">
                  <X className="size-5" />
                </Button>
              </div>

              <div className="space-y-5 p-5">
                <QuickMove
                  person={person}
                  onMove={onMove}
                  configured={configured}
                  activeProfile={activeProfile}
                  onNotice={onNotice}
                />

                <form
                  action={handleSubmit}
                  className="space-y-3 rounded-3xl border bg-background p-4"
                  onFocus={() => {
                    if (selectedProfileIds.length === 0) {
                      setSelectedProfileIds(person.assigned_profile_ids);
                    }
                  }}
                >
                  <p className="text-sm font-black">Contact details</p>
                  <input name="name" defaultValue={person.name} className="h-11 w-full rounded-2xl border bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25" />
                  <ProfileAssignmentPicker
                    profiles={profiles}
                    selectedIds={
                      selectedProfileIds.length > 0
                        ? selectedProfileIds
                        : person.assigned_profile_ids
                    }
                    onChange={setSelectedProfileIds}
                  />
                  <input name="phone" defaultValue={person.phone ?? ""} placeholder="Phone" className="h-11 w-full rounded-2xl border bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25" />
                  <input name="nextFollowUpAt" defaultValue={person.next_follow_up_at?.slice(0, 10) ?? ""} type="date" className="h-11 w-full rounded-2xl border bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25" />
                  <textarea name="notes" defaultValue={person.notes ?? ""} rows={4} placeholder="Care notes" className="w-full resize-none rounded-2xl border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25" />
                  <div className="flex gap-2">
                    <Button disabled={isPending || !configured} type="submit">
                      Save changes
                    </Button>
                    <Button disabled={isPending || !configured} onClick={handleArchive} type="button" variant="destructive">
                      Archive
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
    <div className="grid grid-cols-2 gap-2">
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
        variant="outline"
      >
        <ChevronLeft className="size-4" />
        Back
      </Button>
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
      >
        Next stage
        <ChevronRight className="size-4" />
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
    <form action={handleSubmit} className="space-y-3 rounded-3xl border bg-background p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-primary" />
        <p className="text-sm font-black">Add care note</p>
      </div>
      <textarea name="body" rows={3} placeholder="What happened? What needs prayer or follow-up?" className="w-full resize-none rounded-2xl border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25" />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="nextFollowUpAt" type="date" className="h-10 rounded-2xl border bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/25" />
        <label className="flex items-center gap-2 rounded-2xl border bg-card px-3 text-xs font-semibold">
          <input name="markContacted" type="checkbox" />
          Contacted
        </label>
      </div>
      <Button disabled={isPending || !configured} type="submit" className="w-full">
        <Send className="size-4" />
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
    <section className="rounded-3xl border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-black">Activity timeline</p>
        <Clock3 className="size-4 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        {events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="rounded-2xl bg-card p-3">
              <div className="flex items-start gap-2">
                <ProfileAvatar
                  profile={
                    profiles.find((profile) => profile.id === event.actor_profile_id) ??
                    null
                  }
                  size="xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {profiles.find((profile) => profile.id === event.actor_profile_id)?.name ??
                      "System"}
                  </p>
                </div>
              </div>
              {event.body ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.body}</p>
              ) : null}
              <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {formatDate(event.created_at)}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">
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
    xs: "size-8 rounded-xl text-xs",
    sm: "size-9 rounded-xl text-xs",
    md: "size-10 rounded-2xl text-sm",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border bg-card font-black text-primary",
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
        profile?.name.slice(0, 1).toUpperCase() ?? "?"
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
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex -space-x-2">
        {profiles.slice(0, 3).map((profile) => (
          <ProfileAvatar key={profile.id} profile={profile} size="xs" />
        ))}
      </div>
      <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
        {profiles.length > 0
          ? profiles.map((profile) => profile.name).join(", ")
          : "No profiles"}
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
    <div className="rounded-2xl border bg-card p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="px-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
            Assigned profiles ({selectedIds.length}/3)
          </p>
          <ProfileStack profiles={selectedProfiles} className="mt-2" />
        </div>
        <Button onClick={() => setOpen(true)} type="button" variant="outline">
          Assign profiles
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
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                    Assign profiles
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight">
                    Choose 1 to 3 people
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
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
