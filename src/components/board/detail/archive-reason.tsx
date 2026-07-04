"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { addPersonNote, type BoardPerson } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { useBoardActions, useBoardData } from "../board-context";
import { ARCHIVE_NOTE_PREFIX, getArchiveReason } from "../lib/derive";
import { SectionHeading } from "../primitives/section-heading";

/**
 * Why they're set aside, as its own section of the archived contact's page —
 * read it at a glance, add or reword it after the fact. Saves as a prefixed
 * note (ARCHIVE_NOTE_PREFIX is load-bearing) so the card subtitle and the
 * header line pick the newest reason up automatically.
 */
export function ArchiveReason({ person }: { person: BoardPerson }) {
  const { configured, activeProfile } = useBoardData();
  const actions = useBoardActions();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const reason = getArchiveReason(person.events);

  function openEditor() {
    if (!configured) {
      actions.onNotice("Connect Supabase before editing contacts.");
      return;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before editing contacts.");
      return;
    }

    setDraft(reason ?? "");
    setOpen(true);
  }

  function saveReason() {
    const next = draft.trim();

    if (!activeProfile || !next) {
      return;
    }

    if (next === reason) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await addPersonNote({
        id: person.id,
        body: `${ARCHIVE_NOTE_PREFIX}${next}`,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The reason could not be saved." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onUpdated({ ...person, events: [result.data, ...person.events] });
      setOpen(false);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading
        action={
          <Button
            aria-label={reason ? "Edit the set-aside reason" : "Add a set-aside reason"}
            className="size-6 text-ink-4"
            onClick={openEditor}
            size="icon-xs"
            variant="ghost"
          >
            <Pencil className="size-3.5" />
          </Button>
        }
      >
        Why set aside
      </SectionHeading>

      {reason ? (
        <p className="card-lit t-body-sm rounded-(--sd-r-lg) border border-line bg-surface-raised px-3.5 py-3 italic text-ink-2">
          {reason}
        </p>
      ) : (
        <button
          className="t-body-sm py-1 text-left italic text-ink-3 underline decoration-line underline-offset-4 transition-colors hover:text-ink-2"
          onClick={openEditor}
          type="button"
        >
          No reason recorded — add why they were set aside.
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="t-display-md">Why set aside?</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            className="t-body-sm min-h-24"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Moved away, asked for space, no longer interested…"
            value={draft}
          />
          <DialogFooter>
            <Button
              className="t-label"
              onClick={() => setOpen(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="btn-illuminated t-label"
              disabled={isPending || !draft.trim()}
              onClick={saveReason}
              size="sm"
            >
              Save reason
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
