"use client";

import {
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BookOpenText,
  Check,
  MoreHorizontal,
  NotebookPen,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  deletePersonStudy,
  updatePersonStudyNote,
  updatePersonStudySelection,
  updatePersonStudyTeacher,
  type BoardPerson,
  type PersonStudy,
} from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board-context";
import { formatDate } from "../lib/format";
import {
  CM_TITLES,
  STUDY_TITLES,
  TOTAL_STUDIES,
  VIDEO_TITLES,
  getStudyTitle,
  sortStudiesByLoggedNewest,
} from "../lib/studies";
import { ProfileFramedAvatar } from "../primitives/framed-avatar";
import { SectionHeading } from "../primitives/section-heading";

/** Hold a row this long (without drifting) to open its actions menu. */
const LONG_PRESS_MS = 500;
const LONG_PRESS_DRIFT_PX = 10;

/** One study entry: mono date, teacher portrait, title, quiet row actions. */
function StudyEntry({ person, study }: { person: BoardPerson; study: PersonStudy }) {
  const { activeProfile, configured, profiles } = useBoardData();
  const actions = useBoardActions();
  const [isPending, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(study.notes ?? "");
  const [changeOpen, setChangeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Long-press: touch has no hover to reveal the "…" actions, so holding the
  // row opens the same menu. A drift or early release cancels it.
  const rowRef = useRef<HTMLLIElement>(null);
  const pressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressTypeRef = useRef<string>("mouse");
  const longPressFiredRef = useRef(false);

  function clearPress() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    pressStartRef.current = null;
  }

  function handlePressStart(event: ReactPointerEvent<HTMLLIElement>) {
    longPressFiredRef.current = false;

    // Portaled dialogs/menus bubble through the React tree — only a press
    // that lands on the row itself may arm the timer.
    if (!rowRef.current?.contains(event.target as Node)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    pressTypeRef.current = event.pointerType;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      longPressFiredRef.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }

  function handlePressMove(event: ReactPointerEvent<HTMLLIElement>) {
    const start = pressStartRef.current;

    if (!start) {
      return;
    }

    const drift = Math.hypot(event.clientX - start.x, event.clientY - start.y);

    if (drift > LONG_PRESS_DRIFT_PX) {
      clearPress();
    }
  }

  function suppressClickAfterLongPress(event: ReactMouseEvent<HTMLLIElement>) {
    if (!longPressFiredRef.current) {
      return;
    }

    longPressFiredRef.current = false;

    // Swallow only the ghost click on the row itself — clicks in the
    // portaled menu/dialogs (which bubble here through the React tree)
    // must go through.
    if (rowRef.current?.contains(event.target as Node)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLLIElement>) {
    // Touch long-press raises the platform context menu; ours replaces it.
    if (pressTypeRef.current !== "mouse") {
      event.preventDefault();
    }
  }

  function requireActor() {
    if (!configured) {
      actions.onNotice("Connect Supabase before editing studies.");
      return null;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before editing studies.");
      return null;
    }

    return activeProfile.id;
  }

  function saveNote() {
    const actorProfileId = requireActor();

    if (!actorProfileId) {
      return;
    }

    startTransition(async () => {
      const result = await updatePersonStudyNote({
        id: study.id,
        notes: noteDraft.trim(),
        actorProfileId,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The study note could not be saved." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onStudyRenamed(person.id, result.data);
      setNoteDraft(result.data.notes ?? "");
      setNoteOpen(false);
    });
  }

  function changeStudy(studyNumber: number, catalogTitle: string) {
    const actorProfileId = requireActor();

    if (!actorProfileId) {
      return;
    }

    if (studyNumber === study.study_number) {
      setChangeOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await updatePersonStudySelection({
        id: study.id,
        studyNumber,
        title: catalogTitle,
        actorProfileId,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The study could not be changed." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onStudyRenamed(person.id, result.data);
      setChangeOpen(false);
    });
  }

  function confirmDelete() {
    const actorProfileId = requireActor();

    if (!actorProfileId) {
      return;
    }

    startTransition(async () => {
      const result = await deletePersonStudy({
        id: study.id,
        actorProfileId,
      });

      if (!result.ok) {
        actions.onNotice(result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onStudyDeleted(person.id, study.id);
      setDeleteOpen(false);
    });
  }

  function assignTeacher(profileId: string) {
    const actorProfileId = requireActor();

    if (!actorProfileId || profileId === study.actor_profile_id) {
      return;
    }

    startTransition(async () => {
      const result = await updatePersonStudyTeacher({
        id: study.id,
        teacherProfileId: profileId,
        actorProfileId,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The teacher could not be set." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onStudyRenamed(person.id, result.data);
    });
  }

  const teacher =
    profiles.find((profile) => profile.id === study.actor_profile_id) ?? null;
  const completedNumbers = new Set(person.studies.map((item) => item.study_number));

  return (
    <li
      ref={rowRef}
      className="group flex select-none items-baseline gap-3 py-2 [-webkit-touch-callout:none]"
      onClickCapture={suppressClickAfterLongPress}
      onContextMenu={handleContextMenu}
      onPointerCancel={clearPress}
      onPointerDown={handlePressStart}
      onPointerLeave={clearPress}
      onPointerMove={handlePressMove}
      onPointerUp={clearPress}
    >
      <span className="t-meta-sm w-14 shrink-0 text-ink-4">
        {formatDate(study.studied_at ?? study.created_at)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={
              teacher
                ? `Studied with ${teacher.name} — tap to change`
                : "Set who studied with them"
            }
            className="shrink-0 self-center rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
            disabled={isPending}
            type="button"
          >
            {teacher ? (
              <ProfileFramedAvatar profile={teacher} size="xs" title={teacher.name} />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-4">
                <UserRound className="size-3" />
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="t-meta-sm text-ink-3">
            Who studied with them
          </DropdownMenuLabel>
          {profiles.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              className="gap-2.5"
              onSelect={() => assignTeacher(profile.id)}
            >
              <ProfileFramedAvatar profile={profile} size="xs" />
              <span className="t-body-sm min-w-0 flex-1 truncate">{profile.name}</span>
              {profile.id === study.actor_profile_id ? (
                <Check className="size-3.5 text-brand" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="t-body-sm min-w-0 flex-1 text-ink">
        {getStudyTitle(study)}
        {study.notes ? (
          <span className="mt-0.5 block truncate italic text-ink-3">{study.notes}</span>
        ) : null}
      </span>

      <span className="self-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${getStudyTitle(study)}`}
              className="size-6 text-ink-4"
              size="icon-xs"
              variant="ghost"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="gap-2" onSelect={() => setChangeOpen(true)}>
              <BookOpenText className="size-3.5 text-ink-3" />
              <span className="t-body-sm">Change study</span>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <UserRound className="size-3.5 text-ink-3" />
                <span className="t-body-sm">Who studied with them</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {profiles.map((profile) => (
                  <DropdownMenuItem
                    key={profile.id}
                    className="gap-2.5"
                    onSelect={() => assignTeacher(profile.id)}
                  >
                    <ProfileFramedAvatar profile={profile} size="xs" />
                    <span className="t-body-sm min-w-0 flex-1 truncate">
                      {profile.name}
                    </span>
                    {profile.id === study.actor_profile_id ? (
                      <Check className="size-3.5 text-brand" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem className="gap-2" onSelect={() => setNoteOpen(true)}>
              <NotebookPen className="size-3.5 text-ink-3" />
              <span className="t-body-sm">{study.notes ? "Edit note" : "Add note"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-signal-urgent focus:text-signal-urgent"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              <span className="t-body-sm">Remove</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>

      {/* Note editor */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="t-display-md">Study note</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            className="t-body-sm min-h-24"
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="What stood out, questions raised…"
            value={noteDraft}
          />
          <DialogFooter>
            <Button
              className="t-label"
              onClick={() => setNoteOpen(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="btn-illuminated t-label"
              disabled={isPending}
              onClick={saveNote}
              size="sm"
            >
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change study — re-do the entry against the catalog. */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="gap-0 p-0">
          <DialogHeader className="border-b border-line px-4 py-3 pr-10">
            <DialogTitle className="t-display-md">Change study</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput autoFocus placeholder="Search the catalog…" />
            <CommandList className="max-h-72">
              <CommandEmpty>
                <span className="t-body-sm italic text-ink-3">
                  No study by that name.
                </span>
              </CommandEmpty>
              <CommandGroup heading={`Bible studies · 1–${TOTAL_STUDIES}`}>
                {STUDY_TITLES.map((catalogTitle, index) => {
                  const number = index + 1;
                  const done = completedNumbers.has(number);
                  const isCurrent = number === study.study_number;

                  return (
                    <CommandItem
                      key={number}
                      className="gap-2"
                      disabled={isPending || (done && !isCurrent)}
                      value={`${number} ${catalogTitle}`}
                      onSelect={() => changeStudy(number, catalogTitle)}
                    >
                      <span className="t-meta-sm w-6 shrink-0 text-ink-4">
                        {String(number).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "t-body-sm min-w-0 flex-1 truncate",
                          done && !isCurrent && "text-ink-4"
                        )}
                      >
                        {catalogTitle}
                      </span>
                      {isCurrent ? (
                        <Check className="size-3.5 text-brand" />
                      ) : done ? (
                        <Check className="size-3.5 text-tone-green-ink" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading={`Counter-missionary · FI 1–${CM_TITLES.length}`}>
                {CM_TITLES.map((catalogTitle, index) => {
                  const number = TOTAL_STUDIES + index + 1;
                  const done = completedNumbers.has(number);
                  const isCurrent = number === study.study_number;

                  return (
                    <CommandItem
                      key={number}
                      className="gap-2"
                      disabled={isPending || (done && !isCurrent)}
                      value={`fi ${index + 1} ${catalogTitle}`}
                      onSelect={() => changeStudy(number, catalogTitle)}
                    >
                      <span className="t-meta-sm w-6 shrink-0 text-ink-4">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "t-body-sm min-w-0 flex-1 truncate",
                          done && !isCurrent && "text-ink-4"
                        )}
                      >
                        {catalogTitle}
                      </span>
                      {isCurrent ? (
                        <Check className="size-3.5 text-brand" />
                      ) : done ? (
                        <Check className="size-3.5 text-tone-green-ink" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading={`Video · 1–${VIDEO_TITLES.length}`}>
                {VIDEO_TITLES.map((catalogTitle, index) => {
                  const number = TOTAL_STUDIES + CM_TITLES.length + index + 1;
                  const done = completedNumbers.has(number);
                  const isCurrent = number === study.study_number;

                  return (
                    <CommandItem
                      key={number}
                      className="gap-2"
                      disabled={isPending || (done && !isCurrent)}
                      value={`video ${index + 1} ${catalogTitle}`}
                      onSelect={() => changeStudy(number, catalogTitle)}
                    >
                      <span className="t-meta-sm w-6 shrink-0 text-ink-4">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "t-body-sm min-w-0 flex-1 truncate",
                          done && !isCurrent && "text-ink-4"
                        )}
                      >
                        {catalogTitle}
                      </span>
                      {isCurrent ? (
                        <Check className="size-3.5 text-brand" />
                      ) : done ? (
                        <Check className="size-3.5 text-tone-green-ink" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="t-display-md">
              Remove this study?
            </AlertDialogTitle>
            <AlertDialogDescription className="t-body-sm">
              “{getStudyTitle(study)}” will be removed from {person.name}’s record.
              Their stage may step back if it was reached automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="t-label">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="t-label bg-signal-urgent text-white hover:bg-signal-urgent/90"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Remove study
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/**
 * The study history: every study in the record as ledger lines inside one
 * clean lit box — date, teacher, title. The box stays about eight rows tall
 * and scrolls within itself for longer records. (The all-activity feed is
 * retired; studies are the story.)
 */
export function Journal({ person }: { person: BoardPerson }) {
  const studies = sortStudiesByLoggedNewest(person.studies);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading
        action={
          studies.length > 0 ? (
            <span className="t-meta-sm text-ink-4">{studies.length}</span>
          ) : undefined
        }
      >
        Study history
      </SectionHeading>
      {studies.length > 0 ? (
        <ul className="card-lit max-h-112 divide-y divide-line overflow-y-auto overscroll-contain rounded-(--sd-r-lg) border border-line bg-surface-raised px-3.5 py-1">
          {studies.map((study) => (
            <StudyEntry key={study.id} person={person} study={study} />
          ))}
        </ul>
      ) : (
        <p className="t-body-sm py-1 italic text-ink-3">
          No studies in the record yet — log the first one above.
        </p>
      )}
    </div>
  );
}
