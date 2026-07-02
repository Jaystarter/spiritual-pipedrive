"use client";

import { useState, useTransition } from "react";
import {
  Check,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  deletePersonStudy,
  updatePersonStudyNote,
  updatePersonStudyTeacher,
  updatePersonStudyTitle,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useBoardActions, useBoardData } from "../board-context";
import { formatDate } from "../lib/format";
import { getStudyTitle, sortStudiesByLoggedNewest } from "../lib/studies";
import { ProfileFramedAvatar } from "../primitives/framed-avatar";
import { SectionHeading } from "../primitives/section-heading";

/** One study entry: mono date, teacher portrait, title, quiet row actions. */
function StudyEntry({ person, study }: { person: BoardPerson; study: PersonStudy }) {
  const { activeProfile, configured, profiles } = useBoardData();
  const actions = useBoardActions();
  const [isPending, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(study.notes ?? "");
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(getStudyTitle(study));
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  function saveTitle() {
    const actorProfileId = requireActor();
    const nextTitle = titleDraft.trim();

    if (!actorProfileId || !nextTitle) {
      return;
    }

    startTransition(async () => {
      const result = await updatePersonStudyTitle({
        id: study.id,
        title: nextTitle,
        actorProfileId,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The study could not be renamed." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onStudyRenamed(person.id, result.data);
      setRenameOpen(false);
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

  return (
    <li className="group flex items-baseline gap-3 py-2">
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
        <DropdownMenu>
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
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem className="gap-2" onSelect={() => setNoteOpen(true)}>
              <NotebookPen className="size-3.5 text-ink-3" />
              <span className="t-body-sm">{study.notes ? "Edit note" : "Add note"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-3.5 text-ink-3" />
              <span className="t-body-sm">Rename study</span>
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

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="t-display-md">Study title</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            className="t-body-sm"
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                saveTitle();
              }
            }}
            value={titleDraft}
          />
          <DialogFooter>
            <Button
              className="t-label"
              onClick={() => setRenameOpen(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="btn-illuminated t-label"
              disabled={isPending || !titleDraft.trim()}
              onClick={saveTitle}
              size="sm"
            >
              Rename
            </Button>
          </DialogFooter>
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
 * clean lit box — date, teacher, title. (The all-activity feed is retired;
 * studies are the story.)
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
        <ul className="card-lit divide-y divide-line rounded-(--sd-r-lg) border border-line bg-surface-raised px-3.5 py-1">
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
