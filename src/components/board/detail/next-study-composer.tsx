"use client";

import { useRef, useState, useTransition } from "react";
import { BookOpenText, CalendarClock, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { addPersonStudy, type BoardPerson } from "@/app/actions";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board-context";
import { celebrateFrom } from "../lib/celebrate";
import { getStreak } from "../lib/engagement";
import { getDateValue, shiftDateValue } from "../lib/format";
import {
  CM_TITLES,
  STUDY_TITLES,
  TOTAL_STUDIES,
  getNextStudyNumber,
  getStudyCatalogTitle,
  getStudyTitle,
} from "../lib/studies";
import { formatPillDate } from "../primitives/date-trigger";
import { TickBar } from "../primitives/tick-bar";

/** CM ("FI:") studies are stored as numbers 51–68 above the 50 Bible set. */
function catalogTitleFor(studyNumber: number) {
  if (studyNumber > TOTAL_STUDIES) {
    return CM_TITLES[studyNumber - TOTAL_STUDIES - 1] ?? `Study ${studyNumber}`;
  }

  return getStudyCatalogTitle(studyNumber);
}

/**
 * The study composer, chromeless: the progress rule leads, then the
 * testimony line for finished journeys, then the centered hero (the serif
 * title IS the catalog picker) and one full-width split control — the gold
 * face logs, the tail picks the date.
 */
export function NextStudyComposer({
  person,
  stage,
}: {
  person: BoardPerson;
  stage: Stage;
}) {
  const { configured, activeProfile, people } = useBoardData();
  const actions = useBoardActions();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenNumber, setChosenNumber] = useState<number | null>(null);
  const [studyDate, setStudyDate] = useState(() => getDateValue(null));
  const pendingRef = useRef(false);
  const logButtonRef = useRef<HTMLButtonElement>(null);

  const completedNumbers = new Set(person.studies.map((study) => study.study_number));
  const nextNumber = chosenNumber ?? getNextStudyNumber(person.studies);
  const existingStudy = person.studies.find(
    (study) => study.study_number === nextNumber
  );
  const title = existingStudy ? getStudyTitle(existingStudy) : catalogTitleFor(nextNumber);

  const today = getDateValue(null);
  const yesterday = shiftDateValue(today, -1);
  const dateLabel =
    studyDate === today ? "Today" : studyDate === yesterday ? "Yesterday" : null;

  const bibleCompleted = new Set(
    [...completedNumbers].filter((number) => number <= TOTAL_STUDIES)
  );
  const cmCompleted = new Set(
    [...completedNumbers]
      .filter((number) => number > TOTAL_STUDIES)
      .map((number) => number - TOTAL_STUDIES)
  );
  function logStudy() {
    if (!configured) {
      actions.onNotice("Connect Supabase before logging studies.");
      return;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before logging studies.");
      return;
    }

    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    // Was the lamp lit before this log? If not, this entry extends the streak.
    const streakBefore = getStreak(people, activeProfile.id);
    startTransition(async () => {
      const result = await addPersonStudy({
        id: person.id,
        studyNumber: nextNumber,
        title,
        studiedAt: studyDate,
        actorProfileId: activeProfile.id,
      });

      pendingRef.current = false;

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The study could not be saved." : result.error);
        return;
      }

      actions.onNotice(undefined);
      actions.onStudyLogged(person.id, result.data.study, result.data.event);
      setChosenNumber(null);
      setStudyDate(getDateValue(null));

      // The joy: a burst from the button, and a word when the lamp lights.
      celebrateFrom(logButtonRef.current, {
        colors: [
          "var(--sd-accent-hi)",
          "var(--sd-accent)",
          "var(--sd-spark)",
          `var(--tone-${stage.tone}-core)`,
        ],
      });

      if (!streakBefore.litToday) {
        const nextStreak = streakBefore.count + 1;
        toast.success(
          nextStreak > 1
            ? `Day ${nextStreak} — the lamp stays lit 🔥`
            : "The lamp is lit — day 1 of a new streak"
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* The progress rule leads. */}
      <div className="flex flex-col gap-1.5">
        <TickBar total={TOTAL_STUDIES} completed={bibleCompleted} tone={stage.tone} />
        {cmCompleted.size > 0 ? (
          <TickBar
            className="max-w-[36%]"
            total={CM_TITLES.length}
            completed={cmCompleted}
            tone="violet"
          />
        ) : null}
      </div>

      {/* The picker wears its purpose: an unmistakable select control, not a
          preset headline — the suggested next study is a default, not a
          decision already made. */}
      {/* modal: the sheet's scroll lock only whitelists its own subtree, and
          this popover portals to body — without its own lock layer, wheel and
          touch scrolling inside the catalog list gets swallowed. */}
      <Popover modal open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Choose which study to log"
            className={cn(
              "group/hero card-lit w-full rounded-(--sd-r-md) border bg-surface px-4 py-3 text-left",
              "border-[color-mix(in_oklch,var(--sd-accent)_35%,var(--sd-line))] transition-colors",
              "hover:border-[color-mix(in_oklch,var(--sd-accent)_60%,var(--sd-line))]"
            )}
            type="button"
          >
            <span className="t-meta-sm flex items-center justify-between gap-2">
              <span className="text-ink-4">
                {nextNumber > TOTAL_STUDIES
                  ? `FI ${nextNumber - TOTAL_STUDIES}`
                  : `Study ${String(nextNumber).padStart(2, "0")}`}
              </span>
              <span className="text-brand">Tap to change</span>
            </span>
            <span className="mt-1 flex items-center justify-between gap-3">
              <span className="t-display-md line-clamp-2 min-w-0 flex-1 text-ink">
                {title}
              </span>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  "border border-[color-mix(in_oklch,var(--sd-accent)_50%,transparent)]",
                  "bg-[color-mix(in_oklch,var(--sd-accent)_10%,transparent)] text-gilt",
                  "transition-transform group-hover/hero:translate-y-0.5"
                )}
              >
                <ChevronDown className="size-4" />
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0" sideOffset={6}>
          <Command>
            <CommandInput placeholder="Search the catalog…" />
            {/* Pick the date without leaving the catalog. */}
            <div className="flex items-center gap-1.5 border-b border-line p-2">
              <CalendarClock className="size-3.5 shrink-0 text-ink-4" />
              {[
                ["Today", today],
                ["Yesterday", yesterday],
              ].map(([optionLabel, optionValue]) => (
                <button
                  key={optionLabel}
                  className={cn(
                    "t-label rounded-(--sd-r-sm) border border-line px-2 py-1 transition-colors hover:border-line-strong",
                    studyDate === optionValue && "border-brand text-brand"
                  )}
                  onClick={() => setStudyDate(optionValue)}
                  type="button"
                >
                  {optionLabel}
                </button>
              ))}
              <input
                aria-label="Study date"
                className="t-body-sm min-w-0 flex-1 rounded-(--sd-r-sm) border border-line bg-surface px-2 py-1 text-ink shadow-(--sd-shadow-well)"
                max={today}
                onChange={(event) => {
                  if (event.target.value) {
                    setStudyDate(event.target.value);
                  }
                }}
                type="date"
                value={studyDate}
              />
            </div>
            <CommandList className="max-h-72">
              <CommandEmpty>
                <span className="t-body-sm italic text-ink-3">
                  No study by that name.
                </span>
              </CommandEmpty>
              <CommandGroup heading={`Bible studies · 1–${TOTAL_STUDIES}`}>
                {STUDY_TITLES.map((catalogTitle, index) => {
                  const number = index + 1;
                  const done = completedNumbers.has(number);

                  return (
                    <CommandItem
                      key={number}
                      className="gap-2"
                      value={`${number} ${catalogTitle}`}
                      onSelect={() => {
                        setChosenNumber(number);
                        setPickerOpen(false);
                      }}
                    >
                      <span className="t-meta-sm w-6 shrink-0 text-ink-4">
                        {String(number).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "t-body-sm min-w-0 flex-1 truncate",
                          done && "text-ink-4"
                        )}
                      >
                        {catalogTitle}
                      </span>
                      {done ? <Check className="size-3.5 text-tone-green-ink" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading={`Counter-missionary · FI 1–${CM_TITLES.length}`}>
                {CM_TITLES.map((catalogTitle, index) => {
                  const number = TOTAL_STUDIES + index + 1;
                  const done = completedNumbers.has(number);

                  return (
                    <CommandItem
                      key={number}
                      className="gap-2"
                      value={`fi ${index + 1} ${catalogTitle}`}
                      onSelect={() => {
                        setChosenNumber(number);
                        setPickerOpen(false);
                      }}
                    >
                      <span className="t-meta-sm w-6 shrink-0 text-ink-4">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "t-body-sm min-w-0 flex-1 truncate",
                          done && "text-ink-4"
                        )}
                      >
                        {catalogTitle}
                      </span>
                      {done ? <Check className="size-3.5 text-tone-green-ink" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* One whole gold button — the date lives in the catalog dropdown. */}
      <button
        ref={logButtonRef}
        className={cn(
          "btn-illuminated t-label flex h-10 w-full items-center justify-center gap-1.5 rounded-(--sd-r-md) px-3",
          (isPending || !configured) && "pointer-events-none opacity-50"
        )}
        disabled={isPending || !configured}
        onClick={logStudy}
        type="button"
      >
        <BookOpenText className="size-4" />
        Log as studied · {dateLabel ?? formatPillDate(studyDate)}
      </button>
    </div>
  );
}
