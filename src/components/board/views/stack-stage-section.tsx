"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import type { BoardPerson } from "@/app/actions";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import {
  displayStageCopy,
  getEmptyStageMessage,
  getTopActivePreviewPeople,
} from "../lib/derive";
import { getToneStyle, toneVars } from "../lib/stage-theme";
import { EmptyState } from "../primitives/empty-state";
import { PersonFramedAvatar } from "../primitives/framed-avatar";
import { StageRibbon } from "../primitives/stage-ribbon";
import { PersonCard } from "../cards/person-card";

type StackStageSectionProps = {
  stage: Stage;
  people: BoardPerson[];
  expanded: boolean;
  onToggle: () => void;
};

/** One chapter of the table of contents. Collapsed, it previews the faces. */
export function StackStageSection({
  stage,
  people,
  expanded,
  onToggle,
}: StackStageSectionProps) {
  const tone = getToneStyle(stage.tone);
  const preview = getTopActivePreviewPeople(people);

  return (
    <section
      id={`stack-stage-${stage.id}`}
      className="card-lit scroll-mt-20 overflow-hidden rounded-(--sd-r-lg) border border-line bg-surface"
    >
      <button
        aria-expanded={expanded}
        className="tone-wash-head flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:brightness-[1.02]"
        style={toneVars(stage.tone)}
        onClick={onToggle}
        type="button"
      >
        <StageRibbon tone={stage.tone} size="full" className="-mt-3" />
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
        {!expanded && preview.length > 0 ? (
          <span className="hidden -space-x-2 sm:flex">
            {preview.slice(0, 5).map((person) => (
              <PersonFramedAvatar
                key={person.id}
                person={person}
                size="xs"
                className="ring-2 ring-surface"
              />
            ))}
          </span>
        ) : null}
        <span className={cn("t-display-lg tabular-nums leading-none", tone.ink)}>
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
          >
            <div aria-hidden className={cn("mx-3.5 border-b-[1.5px]", tone.rule)} />
            {people.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 p-2 lg:grid-cols-2 2xl:grid-cols-3">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="overflow-hidden rounded-(--sd-r-md) border border-line bg-surface-raised transition-[box-shadow,transform] duration-(--dur-base) hover:-translate-y-px hover:shadow-(--sd-shadow-2)"
                  >
                    <PersonCard person={person} stage={stage} sortableDisabled />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                className="m-3"
                message={getEmptyStageMessage(stage)}
                tone={stage.tone}
              />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
