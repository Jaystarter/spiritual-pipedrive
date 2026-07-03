"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";

import { saveStages, type BoardPerson } from "@/app/actions";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  STAGE_TONE_NAMES,
  createStageId,
  getFallbackTone,
  normalizeStages,
  type Stage,
  type StageId,
} from "@/lib/stages";
import { cn } from "@/lib/utils";

import { displayStageCopy } from "../lib/derive";
import { getToneStyle } from "../lib/stage-theme";
import { SectionHeading } from "../primitives/section-heading";
import { StageRibbon } from "../primitives/stage-ribbon";

const STAGE_SAVE_TIMEOUT_MS = 20000;

// Guard against a hung network request leaving the modal stuck on "Saving…".
function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms);

    promise
      .then((value) => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}

type EditStagesDialogProps = {
  open: boolean;
  stages: Stage[];
  people: BoardPerson[];
  configured: boolean;
  onClose: () => void;
  onSaved: (stages: Stage[]) => void;
};

/**
 * The stage editor: every lane as a ribbon row — rename, reorder, recolor,
 * hide, add. Deleting requires typing the stage's name and is refused while
 * contacts still live there.
 */
export function EditStagesDialog({
  open,
  stages,
  people,
  configured,
  onClose,
  onSaved,
}: EditStagesDialogProps) {
  const [draftStages, setDraftStages] = useState<Stage[]>(() => normalizeStages(stages));
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [deleteNameDraft, setDeleteNameDraft] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const activeCounts = useMemo(() => {
    const counts = new Map<StageId, number>();

    for (const person of people) {
      counts.set(person.stage, (counts.get(person.stage) ?? 0) + 1);
    }

    return counts;
  }, [people]);
  const visibleCount = draftStages.filter((stage) => !stage.isHidden).length;

  const stagesRef = useRef(stages);

  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Only re-seed the draft when the sheet opens — re-running on every
    // `stages` change would clobber optimistic edits from our own saves.
    const frame = window.requestAnimationFrame(() => {
      setDraftStages(normalizeStages(stagesRef.current));
      setDeleteTarget(null);
      setDeleteNameDraft("");
      setNotice(undefined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

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

  function addDraftStage() {
    setDraftStages((current) => {
      const label = "New Stage";
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
    setNotice("Name the new stage, then save.");
  }

  function toggleHidden(stage: Stage) {
    if (!stage.isHidden && visibleCount <= 1) {
      setNotice("Keep at least one stage visible.");
      return;
    }

    if (!stage.isHidden && (activeCounts.get(stage.id) ?? 0) > 0) {
      const count = activeCounts.get(stage.id) ?? 0;
      setNotice(
        `Move ${count} contact${count === 1 ? "" : "s"} out of ${stage.label} before hiding it.`
      );
      return;
    }

    updateDraftStage(stage.id, { isHidden: !stage.isHidden });
    setNotice(undefined);
  }

  function requestDelete(stage: Stage) {
    const count = activeCounts.get(stage.id) ?? 0;

    if (visibleCount <= 1 && !stage.isHidden) {
      setNotice("Keep at least one stage visible.");
      return;
    }

    if (count > 0) {
      setNotice(
        `Move ${count} contact${count === 1 ? "" : "s"} out of ${stage.label} before deleting it.`
      );
      return;
    }

    setDeleteTarget(stage);
    setDeleteNameDraft("");
  }

  function persistStages(
    stagesToSave: Stage[],
    {
      closeOnSave = false,
      successNotice,
    }: { closeOnSave?: boolean; successNotice?: string } = {}
  ) {
    if (!configured) {
      setNotice("Connect Supabase before editing stages.");
      return;
    }

    const previousStages = stages;
    const optimisticStages = normalizeStages(stagesToSave);

    // Reflect the edit on the board immediately; roll back if rejected.
    onSaved(optimisticStages);
    setDraftStages(optimisticStages);
    setNotice(undefined);

    startTransition(async () => {
      try {
        const result = await withTimeout(
          saveStages({ stages: stagesToSave }),
          STAGE_SAVE_TIMEOUT_MS,
          "Saving took too long. Check your connection and try again."
        );

        if (!result.ok || !result.data) {
          onSaved(previousStages);
          setDraftStages(normalizeStages(previousStages));
          setNotice(result.ok ? "Stages could not be saved." : result.error);
          return;
        }

        onSaved(result.data);
        setDraftStages(result.data);
        setNotice(successNotice);

        if (closeOnSave) {
          onClose();
        }
      } catch (error) {
        // Unknown outcome (timeout): keep the optimistic edit but say so.
        setNotice(
          error instanceof Error
            ? error.message
            : "We couldn't confirm the save. Refresh to check whether it was stored."
        );
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    const nextStages = draftStages.map((item) =>
      item.id === deleteTarget.id ? { ...item, isHidden: true } : item
    );

    setDeleteTarget(null);
    setDeleteNameDraft("");
    persistStages(nextStages, {
      successNotice: `${deleteTarget.label} was removed from the board.`,
    });
  }

  // Accept the stored label or its displayed form (legacy "Hunting" renders
  // as "Sowing Seeds").
  const deleteNameMatches =
    deleteTarget !== null &&
    [deleteTarget.label, displayStageCopy(deleteTarget.label)].some(
      (candidate) => deleteNameDraft.trim().toLowerCase() === candidate.trim().toLowerCase()
    );

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className="flex w-full flex-col gap-0 border-line bg-surface-raised p-0 sm:max-w-[480px]"
        side="right"
      >
        <SheetTitle className="gilt-wash-head t-display-md border-b border-line px-5 pb-4 pt-5 text-ink">
          The stages of the journey
        </SheetTitle>
        <SheetDescription className="sr-only">
          Rename, reorder, recolor, hide, add, or delete board stages.
        </SheetDescription>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {notice ? (
            <p className="t-body-sm rounded-(--sd-r-sm) border border-line bg-surface-sunken px-3 py-2 text-signal-wane">
              {notice}
            </p>
          ) : null}

          {draftStages.map((stage, index) => {
            const count = activeCounts.get(stage.id) ?? 0;

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex flex-col gap-2.5 rounded-(--sd-r-md) border border-line bg-surface p-3",
                  stage.isHidden && "opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <StageRibbon tone={stage.tone} size="full" className="-ml-1 -mt-1" />
                  <Input
                    aria-label={`Name for ${stage.label}`}
                    className="t-display-sm h-9 border-transparent bg-transparent px-1.5 text-ink hover:border-line focus-visible:border-line"
                    onChange={(event) =>
                      updateDraftStage(stage.id, { label: event.target.value })
                    }
                    value={stage.label}
                  />
                  <span className="t-meta-sm shrink-0 text-ink-4">
                    {count > 0 ? `${count}` : ""}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <Button
                      aria-label={`Move ${stage.label} up`}
                      className="size-7 text-ink-4"
                      disabled={index === 0}
                      onClick={() => moveDraftStage(stage.id, -1)}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      aria-label={`Move ${stage.label} down`}
                      className="size-7 text-ink-4"
                      disabled={index === draftStages.length - 1}
                      onClick={() => moveDraftStage(stage.id, 1)}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      aria-label={stage.isHidden ? `Show ${stage.label}` : `Hide ${stage.label}`}
                      className="size-7 text-ink-4"
                      onClick={() => toggleHidden(stage)}
                      size="icon-xs"
                      variant="ghost"
                    >
                      {stage.isHidden ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      aria-label={`Delete ${stage.label}`}
                      className="size-7 text-signal-urgent hover:text-signal-urgent"
                      onClick={() => requestDelete(stage)}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pl-5">
                  <Input
                    aria-label={`Description for ${stage.label}`}
                    className="t-body-sm h-8 flex-1 border-transparent bg-transparent px-1.5 text-ink-3 hover:border-line focus-visible:border-line"
                    onChange={(event) =>
                      updateDraftStage(stage.id, { description: event.target.value })
                    }
                    placeholder="One-line description"
                    value={stage.description}
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    {STAGE_TONE_NAMES.map((tone) => (
                      <button
                        key={tone}
                        aria-label={`Use the ${tone} ribbon for ${stage.label}`}
                        className={cn(
                          "flex size-5 items-center justify-center rounded-(--sd-r-xs) transition-transform",
                          stage.tone === tone
                            ? "scale-110 ring-1 ring-line-strong"
                            : "opacity-50 hover:opacity-90"
                        )}
                        onClick={() => updateDraftStage(stage.id, { tone })}
                        type="button"
                      >
                        <span
                          className={cn("h-3.5 w-1.5", getToneStyle(tone).core)}
                          style={{
                            clipPath:
                              "polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 3px), 0 100%)",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            className="t-label gap-1.5 self-start text-ink-2"
            onClick={addDraftStage}
            variant="outline"
          >
            <Plus className="size-3.5" />
            Add a stage
          </Button>

          <SectionHeading className="mt-2">
            Hidden stages stay in the ledger
          </SectionHeading>
          <p className="t-body-sm -mt-1 text-ink-4">
            Deleting a stage tucks it away rather than destroying history; the
            eye toggles visibility without ceremony.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button className="t-label" onClick={onClose} variant="ghost">
            Close
          </Button>
          <Button
            className="btn-illuminated t-label"
            disabled={isPending}
            onClick={() => persistStages(draftStages, { closeOnSave: true })}
          >
            {isPending ? "Saving…" : "Save stages"}
          </Button>
        </footer>

        {/* Typed-name delete confirmation. */}
        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(next) => {
            if (!next) {
              setDeleteTarget(null);
              setDeleteNameDraft("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="t-display-md">
                Delete “{deleteTarget ? displayStageCopy(deleteTarget.label) : ""}”?
              </AlertDialogTitle>
              <AlertDialogDescription className="t-body-sm">
                The stage leaves the board (its history is kept). Type the
                stage’s name to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              autoFocus
              aria-label="Type the stage name to confirm"
              className="t-body-sm"
              onChange={(event) => setDeleteNameDraft(event.target.value)}
              placeholder={deleteTarget ? displayStageCopy(deleteTarget.label) : ""}
              value={deleteNameDraft}
            />
            <AlertDialogFooter>
              <AlertDialogCancel className="t-label">Keep the stage</AlertDialogCancel>
              <Button
                className="t-label bg-signal-urgent text-white hover:bg-signal-urgent/90"
                disabled={!deleteNameMatches || isPending}
                onClick={confirmDelete}
              >
                Delete stage
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
