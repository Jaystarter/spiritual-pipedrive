"use client";

import { useMemo, useState, useTransition } from "react";
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
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  GripVertical,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

import {
  archivePerson,
  createPerson,
  movePerson,
  updatePerson,
  type BoardPerson,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isStageId, STAGES, type StageId } from "@/lib/stages";

type BoardProps = {
  initialPeople: BoardPerson[];
  configured: boolean;
  error?: string;
};

type MovePreview = {
  people: BoardPerson[];
  orderedIds: string[];
};

const toneClasses: Record<string, string> = {
  amber: "border-amber-200/70 bg-amber-50/70 text-amber-900",
  sky: "border-sky-200/70 bg-sky-50/70 text-sky-900",
  indigo: "border-indigo-200/70 bg-indigo-50/70 text-indigo-900",
  violet: "border-violet-200/70 bg-violet-50/70 text-violet-900",
  emerald: "border-emerald-200/70 bg-emerald-50/70 text-emerald-900",
  green: "border-green-200/70 bg-green-50/70 text-green-900",
};

const stageAccentClasses: Record<StageId, string> = {
  hunting: "bg-amber-500",
  first_bible_study: "bg-sky-500",
  third_bible_study: "bg-indigo-500",
  seventh_bible_study: "bg-violet-500",
  ready_for_baptism: "bg-emerald-500",
  baptized: "bg-green-600",
};

function sortPeople(people: BoardPerson[]) {
  return [...people].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return a.created_at.localeCompare(b.created_at);
  });
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

export function BibleStudyBoard({ initialPeople, configured, error }: BoardProps) {
  const [people, setPeople] = useState(initialPeople);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState(error);
  const [search, setSearch] = useState("");
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

    if (!query) {
      return people;
    }

    return people.filter((person) =>
      [person.name, person.phone, person.teacher, person.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [people, search]);

  const totalActive = people.filter((person) => person.stage !== "baptized").length;
  const baptizedThisMonth = people.filter((person) => person.stage === "baptized").length;
  const activePerson = activeId
    ? people.find((person) => person.id === activeId) ?? null
    : null;

  function persistMove(personId: string, stage: StageId, orderedIds: string[]) {
    startTransition(async () => {
      const result = await movePerson({ id: personId, stage, orderedIds });

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
  }

  function handleUpdated(person: BoardPerson) {
    setPeople((current) =>
      current.map((item) => (item.id === person.id ? person : item))
    );
  }

  function handleArchived(id: string) {
    setPeople((current) => current.filter((person) => person.id !== id));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-16 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col md:items-center md:py-4">
          <div className="mb-8 flex size-10 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            b
          </div>
          <nav className="flex flex-1 flex-col items-center gap-3" aria-label="Board tools">
            {[BookOpen, UserRound, CalendarDays, CircleDollarSign].map((Icon, index) => (
              <button
                key={index}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  index === 0 && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                type="button"
              >
                <Icon className="size-5" />
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b bg-card/85 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Bible Study Pipeline
                </p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Track each person from first contact to baptism.
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <span className="sr-only">Search people</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search people, teachers, notes"
                    className="h-10 w-full rounded-full border bg-background pl-9 pr-4 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:w-80"
                  />
                </label>
                <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-background text-sm shadow-sm">
                  <div className="px-4 py-2">
                    <span className="block text-xs text-muted-foreground">Active</span>
                    <strong>{totalActive}</strong>
                  </div>
                  <div className="border-l px-4 py-2">
                    <span className="block text-xs text-muted-foreground">Baptized</span>
                    <strong>{baptizedThisMonth}</strong>
                  </div>
                </div>
              </div>
            </div>

            {!configured ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel to
                enable saving. The board UI is ready, but actions are disabled.
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {notice}
              </p>
            ) : null}
          </header>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex-1 overflow-x-auto bg-[linear-gradient(180deg,var(--background),var(--muted))]">
              <div className="grid min-h-[calc(100vh-12rem)] min-w-[1120px] grid-cols-6 gap-3 p-4 sm:p-6">
                {STAGES.map((stage) => {
                  const stagePeople = sortPeople(
                    filteredPeople.filter((person) => person.stage === stage.id)
                  );

                  return (
                    <StageColumn
                      key={stage.id}
                      stage={stage}
                      people={stagePeople}
                      configured={configured}
                      isPending={isPending}
                      onCreated={handleCreated}
                      onUpdated={handleUpdated}
                      onArchived={handleArchived}
                      onMove={moveWithButtons}
                      onNotice={setNotice}
                    />
                  );
                })}
              </div>
            </div>

            <DragOverlay>
              {activePerson ? (
                <PersonCard
                  person={activePerson}
                  configured={configured}
                  overlay
                  onUpdated={handleUpdated}
                  onArchived={handleArchived}
                  onMove={moveWithButtons}
                  onNotice={setNotice}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </section>
      </div>
    </main>
  );
}

function StageColumn({
  stage,
  people,
  configured,
  isPending,
  onCreated,
  onUpdated,
  onArchived,
  onMove,
  onNotice,
}: {
  stage: (typeof STAGES)[number];
  people: BoardPerson[];
  configured: boolean;
  isPending: boolean;
  onCreated: (person: BoardPerson) => void;
  onUpdated: (person: BoardPerson) => void;
  onArchived: (id: string) => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-full flex-col rounded-3xl border bg-card/80 shadow-sm transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="space-y-3 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn("size-2.5 rounded-full", stageAccentClasses[stage.id])}
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold">{stage.label}</h2>
            </div>
            <p className="min-h-10 text-xs leading-5 text-muted-foreground">
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
            <PersonCard
              key={person.id}
              person={person}
              configured={configured}
              disabled={isPending}
              onUpdated={onUpdated}
              onArchived={onArchived}
              onMove={onMove}
              onNotice={onNotice}
            />
          ))}
          {people.length === 0 ? (
            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed bg-background/70 p-4 text-center text-xs leading-5 text-muted-foreground">
              Drop someone here or add the first card.
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function AddPersonForm({
  stage,
  configured,
  onCreated,
  onNotice,
}: {
  stage: StageId;
  configured: boolean;
  onCreated: (person: BoardPerson) => void;
  onNotice: (message?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    if (!configured) {
      onNotice("Connect Supabase before adding people.");
      return;
    }

    startTransition(async () => {
      const result = await createPerson({
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        teacher: String(formData.get("teacher") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        stage,
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
        className="w-full justify-start rounded-2xl"
        disabled={!configured}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <Plus className="size-4" />
        Add person
      </Button>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-2 rounded-2xl border bg-background p-3">
      <input
        autoFocus
        name="name"
        placeholder="Name"
        className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <input
        name="teacher"
        placeholder="Teacher or companion"
        className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <input
        name="phone"
        placeholder="Phone"
        className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <textarea
        name="notes"
        placeholder="Notes"
        rows={3}
        className="w-full resize-none rounded-xl border bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <div className="flex gap-2">
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

function PersonCard({
  person,
  configured,
  disabled,
  overlay,
  onUpdated,
  onArchived,
  onMove,
  onNotice,
}: {
  person: BoardPerson;
  configured: boolean;
  disabled?: boolean;
  overlay?: boolean;
  onUpdated: (person: BoardPerson) => void;
  onArchived: (id: string) => void;
  onMove: (person: BoardPerson, stage: StageId) => void;
  onNotice: (message?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
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

    startTransition(async () => {
      const result = await archivePerson(person.id);

      if (!result.ok) {
        onNotice(result.error);
        return;
      }

      onNotice(undefined);
      onArchived(person.id);
    });
  }

  function handleSubmit(formData: FormData) {
    if (!configured) {
      onNotice("Connect Supabase before editing people.");
      return;
    }

    startTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        name: String(formData.get("name") ?? ""),
        teacher: String(formData.get("teacher") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });

      if (!result.ok || !result.data) {
        onNotice(result.ok ? "The person could not be updated." : result.error);
        return;
      }

      onNotice(undefined);
      onUpdated(result.data);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <form
        action={handleSubmit}
        className="space-y-2 rounded-2xl border bg-background p-3 shadow-sm"
      >
        <input
          autoFocus
          name="name"
          defaultValue={person.name}
          className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <input
          name="teacher"
          defaultValue={person.teacher ?? ""}
          placeholder="Teacher"
          className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <input
          name="phone"
          defaultValue={person.phone ?? ""}
          placeholder="Phone"
          className="h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <textarea
          name="notes"
          defaultValue={person.notes ?? ""}
          placeholder="Notes"
          rows={3}
          className="w-full resize-none rounded-xl border bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <div className="flex gap-2">
          <Button disabled={isPending} type="submit">
            Save
          </Button>
          <Button
            disabled={isPending}
            onClick={() => setEditing(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-2xl border bg-background p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        isDragging && "opacity-40",
        overlay && "w-64 rotate-1 shadow-2xl"
      )}
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
          <h3 className="truncate text-sm font-semibold">{person.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5" />
            {person.teacher || "No teacher assigned"}
          </p>
        </div>
      </div>

      {person.notes ? (
        <p className="mt-3 line-clamp-3 rounded-xl bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {person.notes}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{person.phone || "No phone"}</span>
        {person.stage === "baptized" && person.baptized_at ? (
          <span>{new Date(person.baptized_at).toLocaleDateString()}</span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex gap-1">
          <Button
            aria-label={`Move ${person.name} backward`}
            disabled={!configured || disabled || !previousStage}
            onClick={() => previousStage && onMove(person, previousStage)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label={`Move ${person.name} forward`}
            disabled={!configured || disabled || !nextStage}
            onClick={() => nextStage && onMove(person, nextStage)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button
            disabled={!configured || disabled || isPending}
            onClick={() => setEditing(true)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Edit
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
    </article>
  );
}
