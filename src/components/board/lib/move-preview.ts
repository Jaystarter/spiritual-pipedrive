// The invariant-bearing module: stage-movement previews and the baptized_at
// set/clear rule. Moved verbatim from the legacy board monolith — behavior
// changes here must be deliberate and tested against the server-side rules
// in src/app/actions.ts.
import type { BoardPerson } from "@/app/actions";
import {
  getAutomaticStudyStageId,
  isManualOnlyStage,
  type Stage,
  type StageId,
} from "@/lib/stages";

import type { MovePreview } from "../types";

export function sortPeople(people: BoardPerson[]) {
  return [...people].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

export function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function isBaptizedLane(stageId: StageId) {
  return stageId === "brothers";
}

export function isLegacyOrCurrentBaptizedStage(stageId: StageId) {
  return stageId === "baptized" || isBaptizedLane(stageId);
}

export function getBaptizedAtForStage(person: BoardPerson, targetStage: StageId) {
  if (isBaptizedLane(targetStage)) {
    return person.baptized_at ?? new Date().toISOString();
  }

  if (targetStage === "baptized" && isLegacyOrCurrentBaptizedStage(person.stage)) {
    return person.baptized_at;
  }

  return null;
}

export function buildMovePreview(
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
  const baptizedAt = getBaptizedAtForStage(person, targetStage);

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

export function getNextSortOrderForStage(
  people: BoardPerson[],
  personId: string,
  stage: StageId
) {
  return (
    Math.max(
      0,
      ...people
        .filter((person) => person.id !== personId && person.stage === stage)
        .map((person) => person.sort_order)
    ) + 1000
  );
}

export function getClientAutomaticStudyStage(
  person: BoardPerson,
  studyCount: number,
  visibleStageIds: Set<StageId>
) {
  if (isManualOnlyStage(person.stage)) {
    return person.stage;
  }

  const targetStage = getAutomaticStudyStageId(studyCount);

  return visibleStageIds.has(targetStage) ? targetStage : person.stage;
}

export function getNextStage(stages: Stage[], stage: StageId, direction: -1 | 1) {
  const index = stages.findIndex((item) => item.id === stage);
  const next = stages[index + direction];

  return next?.id;
}
