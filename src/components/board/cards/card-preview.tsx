"use client";

import type { BoardPerson } from "@/app/actions";
import type { Stage } from "@/lib/stages";

import { getStageById } from "../lib/derive";
import { PersonFramedAvatar } from "../primitives/framed-avatar";
import { StageRibbon } from "../primitives/stage-ribbon";
import { RegistrarLine } from "./person-card";

/** The lifted card riding under the pointer during a drag. */
export function CardDragPreview({
  person,
  stages,
}: {
  person: BoardPerson;
  stages: Stage[];
}) {
  const stage = getStageById(stages, person.stage);

  return (
    <div className="flex min-h-16 w-64 -rotate-1 items-center gap-2.5 rounded-(--sd-r-md) border border-line-strong bg-surface-raised px-2.5 py-2 shadow-(--sd-shadow-2)">
      <StageRibbon tone={stage.tone} size="sliver" className="min-h-10" />
      <PersonFramedAvatar person={person} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-display-sm truncate text-ink">{person.name}</span>
        <RegistrarLine person={person} stage={stage} />
      </div>
    </div>
  );
}
