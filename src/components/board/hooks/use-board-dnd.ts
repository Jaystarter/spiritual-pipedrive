"use client";

// dnd-kit wiring for the board. CONTRACT (do not change without retesting the
// full drag matrix): droppable id = stage.id, sortable id = person.id, and a
// drop target is a lane iff visibleStageIds.has(overId). Archive can only be
// entered via the Archive flow — dropping into it is blocked here; dragging
// OUT of archive stays allowed.
import { useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { BoardPerson } from "@/app/actions";
import type { StageId } from "@/lib/stages";

import { buildMovePreview, sortPeople } from "../lib/move-preview";

type UseBoardDndInput = {
  people: BoardPerson[];
  visibleStageIds: Set<StageId>;
  setPeople: (people: BoardPerson[]) => void;
  setNotice: (notice: string | undefined) => void;
  persistMove: (personId: string, stage: StageId, orderedIds: string[]) => void;
};

export function useBoardDnd({
  people,
  visibleStageIds,
  setPeople,
  setNotice,
  persistMove,
}: UseBoardDndInput) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Mouse drags after 8px of intent; touch drags after a 200ms hold so quick
  // swipes still scroll the board. Cards set touch-action: manipulation.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activePerson = activeId
    ? people.find((person) => person.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    if (!event.over) {
      return;
    }

    const personId = String(event.active.id);
    const overId = String(event.over.id);
    const overPerson = people.find((person) => person.id === overId);
    const targetStage = visibleStageIds.has(overId) ? overId : overPerson?.stage;

    if (!targetStage) {
      return;
    }

    // Archive can only be entered via the Archive button (with a reason).
    // Dropping a non-archived card into the archive lane is blocked here;
    // dragging a card OUT of archive into another lane stays allowed.
    const draggedPerson = people.find((person) => person.id === personId);

    if (
      targetStage === "archive" &&
      draggedPerson &&
      draggedPerson.stage !== "archive"
    ) {
      setNotice("Use the Archive button (with a reason) to archive a contact.");
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

  return {
    sensors,
    activeId,
    activePerson,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
