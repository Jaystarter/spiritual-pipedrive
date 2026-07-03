"use client";

import type { CSSProperties } from "react";
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
  index: number;
  people: BoardPerson[];
  expanded: boolean;
  onToggle: () => void;
};

/**
 * One milestone on the Path: an orbital beacon on the journey line — a
 * glowing core inside a thin orbit ring, a satellite circling it, and a
 * radar ping that cascades down the line stage by stage. Beneath it,
 * people as bare rows. No chrome anywhere.
 */
export function StackStageSection({
  stage,
  index,
  people,
  expanded,
  onToggle,
}: StackStageSectionProps) {
  const tone = getToneStyle(stage.tone);
  const preview = people.slice(0, 4);

  return (
    <section id={`stack-stage-${stage.id}`} className="relative scroll-mt-20">
      {/* The beacon: this stage's orbital system on the line. */}
      <span
        aria-hidden
        className="absolute -left-[26px] top-[17px] size-4"
        style={{ "--tone": tone.coreVar } as CSSProperties}
      >
        {/* A canvas disc so the line passes behind the system. */}
        <span className="absolute inset-0.5 rounded-full bg-canvas" />
        {/* Radar ping, staggered so the pulse travels down the path. */}
        <span
          className="path-ping absolute inset-0 rounded-full"
          style={{ animationDelay: `${index * 0.5}s` }}
        />
        {/* Orbit ring. */}
        <span
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: "color-mix(in oklch, var(--tone) 45%, transparent)",
          }}
        />
        {/* The satellite riding the ring. */}
        <span
          className="path-orbit absolute inset-0"
          style={{
            animationDuration: `${9 + index * 1.6}s`,
            animationDelay: `${index * -1.3}s`,
          }}
        >
          <span
            className="absolute left-1/2 top-0 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "var(--path-sat, var(--tone))" }}
          />
        </span>
        {/* The core: brightens when the stage is open. */}
        <span
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-(--dur-base)",
            expanded ? "size-2" : "size-1.5"
          )}
          style={{
            background: "var(--tone)",
            boxShadow:
              "0 0 10px color-mix(in oklch, var(--tone) 80%, transparent)",
          }}
        />
      </span>

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
              <div className="divide-energy pb-3">
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
