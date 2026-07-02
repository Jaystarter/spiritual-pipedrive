"use client";

import { useState } from "react";

import type { BoardPerson } from "@/app/actions";
import type { Stage, StageId } from "@/lib/stages";
import { cn } from "@/lib/utils";

import type { StackExpandedState } from "../types";
import { displayStageCopy } from "../lib/derive";
import { sortPeople } from "../lib/move-preview";
import { getToneStyle } from "../lib/stage-theme";
import {
  MOBILE_STACK_MEDIA_QUERY,
  useMediaQuery,
} from "../hooks/use-media-query";
import { StageRibbon } from "../primitives/stage-ribbon";
import { StackStageSection } from "./stack-stage-section";

type StackBoardProps = {
  people: BoardPerson[];
  stages: Stage[];
};

/**
 * The table of contents: stages stacked as ribboned sections, with a jump
 * rail of tone chips. On phones one section is open at a time.
 */
export function StackBoard({ people, stages }: StackBoardProps) {
  const isMobile = useMediaQuery(MOBILE_STACK_MEDIA_QUERY);
  const [expanded, setExpanded] = useState<StackExpandedState>(() => {
    const first = stages[0]?.id;

    return first ? { [first]: true } : {};
  });

  function toggleStage(stageId: StageId) {
    setExpanded((current) => {
      const isOpen = Boolean(current[stageId]);

      if (isMobile) {
        // Single-open accordion on phones.
        return isOpen ? {} : { [stageId]: true };
      }

      return { ...current, [stageId]: !isOpen };
    });
  }

  function jumpToStage(stageId: StageId) {
    setExpanded((current) =>
      isMobile ? { [stageId]: true } : { ...current, [stageId]: true }
    );
    window.requestAnimationFrame(() => {
      document
        .getElementById(`stack-stage-${stageId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The ribbon rail: six tone chips, the whole arc in one line. */}
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {stages.map((stage) => {
          const tone = getToneStyle(stage.tone);
          const count = people.filter((person) => person.stage === stage.id).length;
          const isOpen = Boolean(expanded[stage.id]);

          return (
            <button
              key={stage.id}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-3 transition-colors",
                "hover:border-line-strong",
                isOpen && tone.wash
              )}
              onClick={() => jumpToStage(stage.id)}
              type="button"
            >
              <StageRibbon tone={stage.tone} size="chip" className="h-4 w-1.5" />
              <span className="t-label whitespace-nowrap text-ink-2">
                {displayStageCopy(stage.shortLabel)}
              </span>
              <span className={cn("t-meta-sm tabular-nums", tone.ink)}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {stages.map((stage) => (
          <StackStageSection
            key={stage.id}
            stage={stage}
            people={sortPeople(people.filter((person) => person.stage === stage.id))}
            expanded={Boolean(expanded[stage.id])}
            onToggle={() => toggleStage(stage.id)}
          />
        ))}
      </div>
    </div>
  );
}
