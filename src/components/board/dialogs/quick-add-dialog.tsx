"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { createPerson } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { StageId } from "@/lib/stages";

import { useBoardActions, useBoardData } from "../board-context";
import { displayStageCopy } from "../lib/derive";
import { StageRibbon } from "../primitives/stage-ribbon";
import { AssignmentPicker } from "../detail/assignment-picker";

/**
 * A new name in the book. Radix Dialog (focus-trapped, scroll-locked);
 * writing the name in serif is the point — an entry, not a form.
 */
export function QuickAddDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { visibleStages, activeProfile, configured } = useBoardData();
  const actions = useBoardActions();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<StageId>(visibleStages[0]?.id ?? "hunting");
  const [assignedProfileIds, setAssignedProfileIds] = useState<string[]>(() =>
    activeProfile ? [activeProfile.id] : []
  );
  const [isPending, startTransition] = useTransition();
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setName("");
      setPhone("");
      setNotes("");
      setStage(visibleStages[0]?.id ?? "hunting");
      setAssignedProfileIds(activeProfile ? [activeProfile.id] : []);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeProfile, open, visibleStages]);

  function submit(addAnother: boolean) {
    if (!configured) {
      actions.onNotice("Connect Supabase before adding people.");
      return;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before adding people.");
      return;
    }

    startTransition(async () => {
      const result = await createPerson({
        name,
        phone,
        notes,
        stage,
        assignedProfileIds,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The person could not be created." : result.error);
        return;
      }

      actions.onNotice(undefined);

      if (addAnother) {
        // Keep the book open: record the entry on the board without leaving.
        actions.onCreated(result.data);
        actions.onSelect(null);
        setName("");
        setPhone("");
        setNotes("");
        window.requestAnimationFrame(() => nameInputRef.current?.focus());
        return;
      }

      actions.onCreated(result.data);
      onClose();
    });
  }

  const selectedStage = visibleStages.find((item) => item.id === stage);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md gap-5 border-line bg-surface-raised">
        <DialogHeader>
          <DialogTitle className="t-display-md text-ink">
            A new name in the book
          </DialogTitle>
          <DialogDescription className="t-body-sm text-ink-3">
            Where they start, and who walks with them.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <Input
            ref={nameInputRef}
            autoFocus
            aria-label="Full name"
            className="t-display-sm h-12 border-line bg-surface px-3.5 text-ink placeholder:italic placeholder:text-ink-4"
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name…"
            value={name}
          />

          <Input
            aria-label="Phone number"
            autoComplete="off"
            className="t-body-sm h-11 border-line bg-surface px-3.5"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone number (optional)"
            type="tel"
            value={phone}
          />

          <Select value={stage} onValueChange={(value) => setStage(value)}>
            <SelectTrigger
              aria-label="Starting stage"
              className="t-body-sm h-11 w-full border-line bg-surface"
            >
              <span className="flex items-center gap-2.5">
                {selectedStage ? (
                  <StageRibbon tone={selectedStage.tone} size="chip" className="size-4" />
                ) : null}
                <SelectValue placeholder="Starting stage" />
              </span>
            </SelectTrigger>
            <SelectContent>
              {visibleStages
                .filter((item) => item.id !== "archive")
                .map((item) => (
                  <SelectItem key={item.id} className="gap-2" value={item.id}>
                    <span className="flex items-center gap-2.5">
                      <StageRibbon tone={item.tone} size="chip" className="size-4" />
                      <span className="t-body-sm">{displayStageCopy(item.label)}</span>
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <AssignmentPicker
            assignedProfileIds={assignedProfileIds}
            onChange={setAssignedProfileIds}
          />

          <Textarea
            aria-label="Care notes"
            className="t-body-sm min-h-20 border-line bg-surface"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Care notes (optional)"
            value={notes}
          />

          <DialogFooter className="gap-2">
            <Button
              className="t-label"
              disabled={isPending}
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="t-label"
              disabled={isPending || assignedProfileIds.length < 1 || !name.trim()}
              onClick={() => submit(true)}
              type="button"
              variant="outline"
            >
              Add &amp; another
            </Button>
            <Button
              className="btn-illuminated t-label"
              disabled={isPending || assignedProfileIds.length < 1 || !name.trim()}
              type="submit"
            >
              Add person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
