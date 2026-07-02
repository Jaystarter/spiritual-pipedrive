"use client";

import { Check, ChevronDown } from "lucide-react";

import type { BoardPerson } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board-context";
import { displayStageCopy } from "../lib/derive";
import { getToneStyle } from "../lib/stage-theme";
import { StageRibbon } from "./stage-ribbon";

/**
 * The person's place, worn as a single ribbon chip — tap it to move them.
 * (One clean badge instead of the six-chip row; the chip is the picker.)
 * Archive is deliberately absent: it is only entered through the archive
 * flow (with a reason).
 */
export function StageStepper({
  person,
  stages,
  className,
}: {
  person: BoardPerson;
  stages: Stage[];
  className?: string;
}) {
  const { isPending, configured } = useBoardData();
  const actions = useBoardActions();
  const options = stages.filter((stage) => stage.id !== "archive");
  const current =
    stages.find((stage) => stage.id === person.stage) ?? options[0];

  if (!current) {
    return null;
  }

  const tone = getToneStyle(current.tone);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Stage: ${displayStageCopy(current.label)}. Tap to move.`}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-transparent py-1 pl-2 pr-2.5 transition-colors",
            tone.wash,
            tone.ink,
            "hover:brightness-[1.03]",
            className
          )}
          disabled={isPending || !configured}
          type="button"
        >
          <StageRibbon tone={current.tone} size="chip" className="h-3.5 w-1.5" />
          <span className="t-meta-sm whitespace-nowrap">
            {displayStageCopy(current.shortLabel)}
          </span>
          <ChevronDown className="size-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="t-meta-sm text-ink-3">
          Move along the journey
        </DropdownMenuLabel>
        {options.map((stage) => {
          const isCurrent = stage.id === person.stage;

          return (
            <DropdownMenuItem
              key={stage.id}
              className="gap-2.5"
              disabled={isCurrent}
              onSelect={() => actions.onMove(person, stage.id)}
            >
              <StageRibbon tone={stage.tone} size="chip" className="h-4 w-1.5" />
              <span className="t-body-sm min-w-0 flex-1 truncate">
                {displayStageCopy(stage.label)}
              </span>
              {isCurrent ? <Check className="size-3.5 text-brand" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
