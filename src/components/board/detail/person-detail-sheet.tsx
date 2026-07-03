"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { Archive, Camera, NotebookPen, Pencil, Trash2 } from "lucide-react";

import {
  addPersonNote,
  deletePerson,
  updatePerson,
  updatePersonAvatar,
  type BoardPerson,
} from "@/app/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board-context";
import { useAutosaveDetails } from "../hooks/use-autosave-details";
import { fileToAvatarDataUrl } from "../lib/avatar";
import {
  ARCHIVE_NOTE_PREFIX,
  getArchiveReason,
  getStageById,
} from "../lib/derive";
import { toneVars } from "../lib/stage-theme";
import { FramedAvatar } from "../primitives/framed-avatar";
import { SectionHeading } from "../primitives/section-heading";
import { StageRibbon } from "../primitives/stage-ribbon";
import { StageStepper } from "../primitives/stage-stepper";
import { UrgencyMeter } from "../primitives/urgency-meter";
import { AssignmentPicker } from "./assignment-picker";
import { Journal } from "./journal";
import { NextStudyComposer } from "./next-study-composer";

/**
 * The person's page in the ledger: identity and journey in the tone-washed
 * header, then Care & Studies, the study history, Notes, and People —
 * everything about one soul in one scroll.
 */
export function PersonDetailSheet({ person }: { person: BoardPerson | null }) {
  const { visibleStages, configured, activeProfile } = useBoardData();
  const actions = useBoardActions();
  const autosave = useAutosaveDetails(person);

  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(person?.name ?? "");
  const [lifeStatus, setLifeStatusState] = useState<BoardPerson["life_status"]>(
    person?.life_status ?? null
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const [, startSaveTransition] = useTransition();
  const [isArchivePending, startArchiveTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [, startAvatarTransition] = useTransition();

  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isCommittingNameRef = useRef(false);

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

  if (!person) {
    return null;
  }

  const stage = getStageById(visibleStages, person.stage);
  const archived = person.stage === "archive";
  const journeyDone = archived || person.stage === "brothers" || person.stage === "baptized";
  function canEdit() {
    if (!configured) {
      actions.onNotice("Connect Supabase before editing people.");
      return null;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before editing people.");
      return null;
    }

    return activeProfile.id;
  }

  function commitName() {
    const actorProfileId = canEdit();

    if (!actorProfileId || !person || isCommittingNameRef.current) {
      return;
    }

    const nextName = nameDraft.trim();

    if (!nextName) {
      actions.onNotice("A card needs a name.");
      return;
    }

    if (nextName === person.name) {
      setIsNameEditing(false);
      actions.onNotice(undefined);
      return;
    }

    isCommittingNameRef.current = true;
    startSaveTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        name: nextName,
        actorProfileId,
      });

      isCommittingNameRef.current = false;

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The person could not be renamed." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onUpdated(result.data);
      setNameDraft(result.data.name);
      setIsNameEditing(false);
    });
  }

  function setLifeStatus(next: NonNullable<BoardPerson["life_status"]> | "") {
    const actorProfileId = canEdit();

    if (!actorProfileId || !person) {
      return;
    }

    const target = next === "" ? null : next;
    const previous = lifeStatus;

    setLifeStatusState(target);
    startSaveTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        lifeStatus: target,
        actorProfileId,
      });

      if (!result.ok || !result.data) {
        setLifeStatusState(previous);
        actions.onNotice(result.ok ? "The person could not be updated." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onUpdated(result.data);
    });
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const actorProfileId = canEdit();

    if (!file || !person || !actorProfileId) {
      return;
    }

    try {
      const avatarUrl = await fileToAvatarDataUrl(file);

      startAvatarTransition(async () => {
        const result = await updatePersonAvatar(person.id, avatarUrl, actorProfileId);

        if (!result.ok || !result.data) {
          actions.onNotice(result.ok ? "Could not update contact photo." : result.error);
          return;
        }

        actions.onNotice(undefined);
        actions.onUpdated(result.data);
      });
    } catch (avatarError) {
      actions.onNotice(
        avatarError instanceof Error ? avatarError.message : "Could not update contact photo."
      );
    }
  }

  function confirmArchive() {
    const actorProfileId = canEdit();

    if (!actorProfileId || !person) {
      return;
    }

    const personId = person.id;
    const reason = archiveReason.trim();

    startArchiveTransition(async () => {
      // Move the contact into the visible, reversible Archive column.
      const moveResult = await updatePerson({
        id: personId,
        stage: "archive",
        actorProfileId,
      });

      if (!moveResult.ok || !moveResult.data) {
        actions.onNotice(
          moveResult.ok ? "The contact could not be archived." : moveResult.error
        );
        return;
      }

      let updatedPerson = moveResult.data;
      let noteError: string | undefined;

      // Log the reason as a note so it shows on the card subtitle — the
      // ARCHIVE_NOTE_PREFIX string is load-bearing.
      if (reason) {
        const noteResult = await addPersonNote({
          id: personId,
          body: `${ARCHIVE_NOTE_PREFIX}${reason}`,
          actorProfileId,
        });

        if (noteResult.ok && noteResult.data) {
          updatedPerson = {
            ...updatedPerson,
            events: [noteResult.data, ...updatedPerson.events],
          };
        } else if (!noteResult.ok) {
          noteError = noteResult.error;
        }
      }

      actions.onUpdated(updatedPerson);
      actions.onNotice(noteError);
      setArchiveReason("");
      setArchiveOpen(false);
    });
  }

  function confirmDelete() {
    const actorProfileId = canEdit();

    if (!actorProfileId || !person) {
      return;
    }

    const personId = person.id;

    startDeleteTransition(async () => {
      const result = await deletePerson(personId, actorProfileId);

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The contact could not be deleted." : result.error);
        return;
      }

      actions.onNotice(undefined);
      setDeleteOpen(false);
      actions.onDeleted(result.data.id);
    });
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          autosave.commitNotes();
          actions.onSelect(null);
        }
      }}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 border-line bg-surface-raised p-0 sm:max-w-[540px]"
        side="right"
      >
        <SheetTitle className="sr-only">{person.name}</SheetTitle>
        <SheetDescription className="sr-only">
          Details, studies, and notes for {person.name}.
        </SheetDescription>

        {/* ------------------------------------------------ header */}
        <header
          className="tone-wash-head border-b border-line px-5 pb-4 pt-5"
          style={toneVars(stage.tone)}
        >
          <div className="flex items-start gap-3.5">
            <div className="group/avatar relative">
              <FramedAvatar
                name={person.name}
                avatarUrl={person.avatar_url}
                size="lg"
              />
              <button
                aria-label={`Update ${person.name}'s photo`}
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full bg-veil text-white",
                  "opacity-0 transition-opacity focus-visible:opacity-100 group-hover/avatar:opacity-100"
                )}
                onClick={() => avatarInputRef.current?.click()}
                type="button"
              >
                <Camera className="size-4" />
              </button>
              <input
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                type="file"
              />
            </div>

            <div className="min-w-0 flex-1">
              {isNameEditing ? (
                <Input
                  ref={nameInputRef}
                  className="t-display-md h-10 border-line bg-surface"
                  onBlur={commitName}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitName();
                    }

                    if (event.key === "Escape") {
                      setNameDraft(person.name);
                      setIsNameEditing(false);
                    }
                  }}
                  value={nameDraft}
                />
              ) : (
                <div className="flex min-w-0 max-w-full items-center gap-1.5">
                  <button
                    className="group/name flex min-w-0 items-center gap-2 text-left"
                    onClick={() => {
                      if (canEdit()) {
                        setNameDraft(person.name);
                        setIsNameEditing(true);
                      }
                    }}
                    type="button"
                  >
                    <span className="t-display-md truncate leading-none text-ink">
                      {person.name}
                    </span>
                    <Pencil className="size-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover/name:opacity-100" />
                  </button>
                  <Popover
                    onOpenChange={(open) => {
                      if (!open) {
                        autosave.commitNotes();
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        aria-label={`Notes and people for ${person.name}`}
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center self-center rounded-(--sd-r-sm) transition-colors hover:bg-surface-sunken",
                          autosave.notes.trim() ? "text-brand" : "text-ink-4 hover:text-ink-2"
                        )}
                        type="button"
                      >
                        <NotebookPen className="size-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-4" sideOffset={8}>
                      <div className="flex flex-col gap-3">
                        <ToggleGroup
                          onValueChange={(value) =>
                            setLifeStatus(
                              value as NonNullable<BoardPerson["life_status"]> | ""
                            )
                          }
                          type="single"
                          value={lifeStatus ?? ""}
                          variant="outline"
                        >
                          <ToggleGroupItem className="t-label gap-1.5" value="student">
                            Student
                          </ToggleGroupItem>
                          <ToggleGroupItem className="t-label gap-1.5" value="worker">
                            Worker
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <Textarea
                          className="t-body min-h-28 border-line bg-surface"
                          onBlur={autosave.commitNotes}
                          onChange={(event) => autosave.updateNotes(event.target.value)}
                          placeholder="Their story, their questions, what matters to them…"
                          value={autosave.notes}
                        />
                        <p className="t-meta-sm text-ink-4">
                          Saves when you leave the box.
                        </p>
                        <SectionHeading>People</SectionHeading>
                        <AssignmentPicker
                          assignedProfileIds={autosave.assignedProfileIds}
                          onChange={autosave.updateAssignedProfiles}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {/* The registrar line: just the stage. */}
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <StageStepper person={person} stages={visibleStages} />
              </div>
            </div>

            {!journeyDone ? <UrgencyMeter className="mt-1.5" person={person} /> : null}
          </div>

          {archived ? (
            <p className="t-body-sm mt-3 flex items-center gap-2 italic text-ink-3">
              <StageRibbon tone={stage.tone} size="chip" className="h-3.5 w-1.5" />
              Set aside{getArchiveReason(person.events) ? ` — ${getArchiveReason(person.events)}` : ""}.
              Tap the stage chip to bring them back.
            </p>
          ) : null}
        </header>

        {/* ------------------------------------------------ body */}
        <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 py-5">
          {/* Care & studies — chromeless and unlabeled: the progress rule leads. */}
          <section className="flex flex-col gap-3" style={toneVars(stage.tone)}>
            <NextStudyComposer person={person} stage={stage} />
          </section>

          <Journal person={person} />

        </div>

        {/* ------------------------------------------------ footer */}
        <footer className="flex items-center justify-between border-t border-line px-5 py-3">
          {!archived ? (
            <Button
              className="t-label gap-1.5 text-signal-wane hover:text-signal-wane"
              onClick={() => {
                if (canEdit()) {
                  setArchiveReason("");
                  setArchiveOpen(true);
                }
              }}
              size="sm"
              variant="ghost"
            >
              <Archive className="size-3.5" />
              Set aside
            </Button>
          ) : (
            <span />
          )}
          <Button
            className="t-label gap-1.5 text-signal-urgent hover:text-signal-urgent"
            onClick={() => {
              if (canEdit()) {
                setDeleteArmed(false);
                setDeleteOpen(true);
              }
            }}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </footer>

        {/* Archive with a reason (the only door into the Archive lane). */}
        <AlertDialog open={archiveOpen} onOpenChange={(open) => !isArchivePending && setArchiveOpen(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="t-display-md">
                Set {person.name} aside?
              </AlertDialogTitle>
              <AlertDialogDescription className="t-body-sm">
                They move to the Archive lane — reversible any time. Leaving a
                reason keeps the story honest.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              autoFocus
              className="t-body-sm min-h-20"
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Why are they being set aside?"
              value={archiveReason}
            />
            <AlertDialogFooter>
              <AlertDialogCancel className="t-label">Keep them active</AlertDialogCancel>
              <Button
                className="btn-illuminated t-label"
                disabled={isArchivePending}
                onClick={confirmArchive}
              >
                {isArchivePending ? "Moving…" : "Move to Archive"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permanent delete — two explicit steps in one dialog. */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="t-display-md">
                Delete {person.name}?
              </AlertDialogTitle>
              <AlertDialogDescription className="t-body-sm">
                {deleteArmed
                  ? "This removes their whole record — studies, notes, and history. There is no undo."
                  : "Their studies, notes, and history go with them. Prefer Set aside if they might return."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="t-label">Keep them</AlertDialogCancel>
              <Button
                className="t-label bg-signal-urgent text-white hover:bg-signal-urgent/90"
                disabled={isDeletePending}
                onClick={() => {
                  if (!deleteArmed) {
                    setDeleteArmed(true);
                    return;
                  }

                  confirmDelete();
                }}
              >
                {isDeletePending
                  ? "Deleting…"
                  : deleteArmed
                    ? "Delete permanently"
                    : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
