"use client";

// The notes/assignment autosave queue, moved semantically-verbatim from the
// legacy PersonDetailPanel. It guards against racing saves (a save in flight
// queues the next one) and replays the latest draft after each server ack so
// rapid type-then-close never loses keystrokes.
import { useEffect, useRef, useState, useTransition } from "react";

import { updatePerson, type BoardPerson } from "@/app/actions";

import { useBoardActions, useBoardData } from "../board-context";
import { sameIds } from "../lib/move-preview";

export function useAutosaveDetails(person: BoardPerson | null) {
  const { configured, activeProfile } = useBoardData();
  const actions = useBoardActions();
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [assignedProfileIds, setAssignedProfileIds] = useState<string[]>(
    person?.assigned_profile_ids ?? []
  );
  const [, startTransition] = useTransition();

  const savedNotesRef = useRef(person?.notes ?? "");
  const savedProfileIdsRef = useRef<string[]>(person?.assigned_profile_ids ?? []);
  const draftRef = useRef({
    notes: person?.notes ?? "",
    assignedProfileIds: person?.assigned_profile_ids ?? [],
  });
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    if (!person) {
      return;
    }

    const nextNotes = person.notes ?? "";
    const frame = window.requestAnimationFrame(() => {
      setNotes(nextNotes);
      setAssignedProfileIds(person.assigned_profile_ids);
    });

    savedNotesRef.current = nextNotes;
    savedProfileIdsRef.current = person.assigned_profile_ids;
    draftRef.current = {
      notes: nextNotes,
      assignedProfileIds: person.assigned_profile_ids,
    };

    return () => window.cancelAnimationFrame(frame);
    // Re-sync only when the panel points at a different person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id]);

  function canEdit() {
    if (!person) {
      return false;
    }

    if (!configured) {
      actions.onNotice("Connect Supabase before editing people.");
      return false;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before editing people.");
      return false;
    }

    return true;
  }

  function save(
    nextNotes = draftRef.current.notes,
    nextProfileIds = draftRef.current.assignedProfileIds
  ) {
    draftRef.current = {
      notes: nextNotes,
      assignedProfileIds: nextProfileIds,
    };

    if (
      nextNotes === savedNotesRef.current &&
      sameIds(nextProfileIds, savedProfileIdsRef.current)
    ) {
      return;
    }

    if (!canEdit() || !person || !activeProfile) {
      return;
    }

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;

    startTransition(async () => {
      const result = await updatePerson({
        id: person.id,
        notes: nextNotes,
        assignedProfileIds: nextProfileIds,
        actorProfileId: activeProfile.id,
      });

      isSavingRef.current = false;

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The person could not be updated." : result.error);
        return;
      }

      const savedNotes = result.data.notes ?? "";
      const savedProfileIds = result.data.assigned_profile_ids;

      actions.onNotice(undefined);
      savedNotesRef.current = savedNotes;
      savedProfileIdsRef.current = savedProfileIds;

      const latestDraft = {
        notes:
          draftRef.current.notes === nextNotes ? savedNotes : draftRef.current.notes,
        assignedProfileIds: sameIds(draftRef.current.assignedProfileIds, nextProfileIds)
          ? savedProfileIds
          : draftRef.current.assignedProfileIds,
      };

      draftRef.current = latestDraft;
      setNotes(latestDraft.notes);
      setAssignedProfileIds(latestDraft.assignedProfileIds);
      actions.onUpdated(result.data);

      pendingSaveRef.current = false;

      if (
        latestDraft.notes !== savedNotesRef.current ||
        !sameIds(latestDraft.assignedProfileIds, savedProfileIdsRef.current)
      ) {
        save(latestDraft.notes, latestDraft.assignedProfileIds);
      }
    });
  }

  function updateNotes(value: string) {
    setNotes(value);
    draftRef.current = { ...draftRef.current, notes: value };
  }

  function commitNotes() {
    save(draftRef.current.notes, draftRef.current.assignedProfileIds);
  }

  function updateAssignedProfiles(ids: string[]) {
    setAssignedProfileIds(ids);
    save(draftRef.current.notes, ids);
  }

  return {
    notes,
    updateNotes,
    commitNotes,
    assignedProfileIds,
    updateAssignedProfiles,
    canEdit,
  };
}
