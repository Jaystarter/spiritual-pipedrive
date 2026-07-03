"use client";

import { motion } from "framer-motion";

import type { BoardPerson } from "@/app/actions";
import type { Stage } from "@/lib/stages";

import { sortPeople } from "../lib/move-preview";
import { PipelineLane } from "./pipeline-lane";

type PipelineBoardProps = {
  people: BoardPerson[];
  stages: Stage[];
};

/** Each step of the ascent rises this much above the one before. */
const RISE_PER_STEP = 26;

/**
 * The ascent: the journey climbs left to right — Sowing Seeds starts at
 * the lowest landing and every stage stands a step higher, so Baptized
 * holds the summit. Archive rests back at ground level (set aside, not
 * an achievement). Lanes share a bottom edge; only their tops stagger.
 */
export function PipelineBoard({ people, stages }: PipelineBoardProps) {
  const journey = stages.filter((stage) => stage.id !== "archive");
  const summit = Math.max(journey.length - 1, 0);

  function riseFor(stage: Stage) {
    if (stage.id === "archive") {
      return summit * RISE_PER_STEP;
    }

    const rank = journey.findIndex((s) => s.id === stage.id);

    return (summit - Math.max(rank, 0)) * RISE_PER_STEP;
  }

  return (
    <div className="flex-1 overflow-x-auto pb-4">
      <div
        className="grid h-full gap-3.5"
        style={{
          gridTemplateColumns: `repeat(${stages.length}, minmax(17.5rem, 1fr))`,
        }}
      >
        {stages.map((stage, index) => (
          <motion.div
            key={stage.id}
            className="flex min-h-0 flex-col"
            style={{ paddingTop: riseFor(stage) }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.32,
              delay: index * 0.045,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <PipelineLane
              stage={stage}
              people={sortPeople(
                people.filter((person) => person.stage === stage.id)
              )}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
