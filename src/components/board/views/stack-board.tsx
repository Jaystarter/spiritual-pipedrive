"use client";

import { useState } from "react";

import type { BoardPerson } from "@/app/actions";
import type { Stage, StageId } from "@/lib/stages";

import type { StackExpandedState } from "../types";
import { sortPeople } from "../lib/move-preview";
import {
  MOBILE_STACK_MEDIA_QUERY,
  useMediaQuery,
} from "../hooks/use-media-query";
import { StackStageSection } from "./stack-stage-section";

type StackBoardProps = {
  people: BoardPerson[];
  stages: Stage[];
};

/**
 * The Path: one luminous line runs the length of the journey, colored
 * through all six stage tones; stages sit on it as glowing nodes and
 * people hang off it as chromeless rows. No ribbons, no pills, no boxes.
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

  return (
    <div className="relative flex flex-col pl-7">
      {/* The journey line: dawn to living green, one unbroken stroke. */}
      <div
        aria-hidden
        className="absolute bottom-6 left-[9px] top-3 w-0.5 rounded-full opacity-75"
        style={{
          background:
            "linear-gradient(to bottom, var(--tone-amber-core), var(--tone-sky-core), var(--tone-indigo-core), var(--tone-violet-core), var(--tone-emerald-core), var(--tone-green-core))",
        }}
      />

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
  );
}
