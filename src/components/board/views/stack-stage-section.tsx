"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import type { BoardPerson } from "@/app/actions";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { displayStageCopy, getEmptyStageMessage } from "../lib/derive";
import { getToneStyle } from "../lib/stage-theme";
import { PersonFramedAvatar } from "../primitives/framed-avatar";
import { PersonCard } from "../cards/person-card";

type StackStageSectionProps = {
  stage: Stage;
  people: BoardPerson[];
  expanded: boolean;
  onToggle: () => void;
};

/**
 * One milestone on the Path: a glowing tone node on the journey line, the
 * stage name in serif, the count in the stage's ink — and beneath it,
 * people as bare rows. No chrome anywhere.
 */
export function StackStageSection({
  stage,
  people,
  expanded,
  onToggle,
}: StackStageSectionProps) {
  const tone = getToneStyle(stage.tone);
  const preview = people.slice(0, 4);

  return (
    <section id={`stack-stage-${stage.id}`} className="relative scroll-mt-20">
      {/* The node: this stage's light on the line. */}
      <span
        aria-hidden
        className="absolute -left-[26px] top-[18px] size-3.5 rounded-full ring-4 ring-canvas"
        style={{
          background: tone.coreVar,
          boxShadow: `0 0 14px color-mix(in oklch, ${tone.coreVar} 65%, transparent)`,
        }}
      />

      <button
        aria-expanded={expanded}
        className="group/milestone flex w-full items-center gap-3 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <h2
          className={cn(
            "t-display-md min-w-0 truncate transition-colors",
            expanded ? "text-ink" : "text-ink-2 group-hover/milestone:text-ink"
          )}
        >
          {displayStageCopy(stage.label)}
        </h2>
        {!expanded && preview.length > 0 ? (
          <span className="ml-1 hidden -space-x-2 sm:flex">
            {preview.map((person) => (
              <PersonFramedAvatar
                key={person.id}
                person={person}
                size="xs"
                className="ring-2 ring-canvas"
              />
            ))}
          </span>
        ) : null}
        <span
          className={cn(
            "t-display-lg ml-auto tabular-nums leading-none",
            tone.ink
          )}
        >
          {people.length}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-4 transition-transform duration-(--dur-base)",
            expanded && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {people.length > 0 ? (
              <div className="divide-y divide-line/60 pb-3">
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    stage={stage}
                    sortableDisabled
                  />
                ))}
              </div>
            ) : (
              <p className="t-body-sm pb-4 pt-1 italic text-ink-4">
                {getEmptyStageMessage(stage)}
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
