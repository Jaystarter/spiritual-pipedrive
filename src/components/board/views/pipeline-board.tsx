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

/** The open ledger: one column per stage, the journey arc left to right. */
export function PipelineBoard({ people, stages }: PipelineBoardProps) {
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
