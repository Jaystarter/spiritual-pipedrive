"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { BoardPerson } from "@/app/actions";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { displayStageCopy, getEmptyStageMessage } from "../lib/derive";
import { getToneStyle, toneVars } from "../lib/stage-theme";
import { EmptyState } from "../primitives/empty-state";
import { StageRibbon } from "../primitives/stage-ribbon";
import { PersonCard } from "../cards/person-card";

type PipelineLaneProps = {
  stage: Stage;
  people: BoardPerson[];
};

/**
 * A ledger column. Stage identity comes from the ribbon bookmark, the
 * tone-washed header, and the tone hairline rule — six tinted headers make
 * the journey arc read across the whole board.
 *
 * dnd contract: the lane is a droppable with id = stage.id; its cards form a
 * SortableContext of person ids.
 */
export function PipelineLane({ stage, people }: PipelineLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const tone = getToneStyle(stage.tone);

  return (
    <section
      ref={setNodeRef}
      aria-label={displayStageCopy(stage.label)}
      className={cn(
        "card-lit flex max-h-[calc(100vh-15rem)] min-h-56 flex-col overflow-hidden rounded-(--sd-r-lg) border border-line bg-surface",
        "transition-[background-color,box-shadow,border-color] duration-(--dur-base) hover:border-line-strong",
        isOver && cn("ring-1 ring-inset", tone.ring, tone.wash)
      )}
    >
      <header
        className="tone-wash-head flex items-start gap-2.5 px-3.5 pb-2 pt-3"
        style={toneVars(stage.tone)}
      >
        <StageRibbon tone={stage.tone} size="full" className="-ml-1.5 -mt-1" />
        <div className="min-w-0 flex-1">
          <h2 className="t-display-sm truncate text-ink">
            {displayStageCopy(stage.label)}
          </h2>
          {stage.description ? (
            <p className="t-meta-sm mt-0.5 truncate text-ink-4">
              {displayStageCopy(stage.description)}
            </p>
          ) : null}
        </div>
        <span className={cn("t-display-lg tabular-nums leading-none", tone.ink)}>
          {people.length}
        </span>
      </header>
      <div aria-hidden className={cn("mx-3.5 border-b-[1.5px]", tone.rule)} />

      <SortableContext
        items={people.map((person) => person.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto px-1 py-1">
          {people.length > 0 ? (
            <div className="divide-y divide-line">
              {people.map((person) => (
                <PersonCard key={person.id} person={person} stage={stage} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="m-2"
              message={getEmptyStageMessage(stage)}
              tone={stage.tone}
            />
          )}
        </div>
      </SortableContext>
    </section>
  );
}
