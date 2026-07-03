"use client";

import { useRef, useState, useTransition } from "react";
import { BookOpenText, Check, ChevronDown } from "lucide-react";
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
import { formatDate, getDateValue, shiftDateValue } from "../lib/format";
import { getToneStyle } from "../lib/stage-theme";
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
  const tone = getToneStyle(stage.tone);
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [chosenNumber, setChosenNumber] = useState<number | null>(null);
  const [studyDate, setStudyDate] = useState(() => getDateValue(null));
  const pendingRef = useRef(false);
  const logButtonRef = useRef<HTMLButtonElement>(null);

  const completedNumbers = new Set(person.studies.map((study) => study.study_number));
  const nextNumber = chosenNumber ?? getNextStudyNumber(person.studies);
  const isCm = nextNumber > TOTAL_STUDIES;
  const alreadyLogged = completedNumbers.has(nextNumber);
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
  const baptized = stage.id === "brothers" || stage.id === "baptized";

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

      {baptized ? (
        <p className="t-body-sm text-tone-green-ink">
          Baptized {person.baptized_at ? formatDate(person.baptized_at) : ""}
        </p>
      ) : null}

      {/* The hero IS the picker: tap the title to choose another study. */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Choose which study to log"
            className="group/hero block w-full text-center"
            type="button"
          >
            <p className={cn("t-meta-sm", tone.ink)}>
              {alreadyLogged ? "Log again" : "Next study"} ·{" "}
              {isCm
                ? `FI ${String(nextNumber - TOTAL_STUDIES).padStart(2, "0")} of ${CM_TITLES.length}`
                : `${String(nextNumber).padStart(2, "0")} of ${TOTAL_STUDIES}`}
            </p>
            <h3 className="t-display-md mt-1 flex items-center justify-center gap-2 text-ink transition-colors group-hover/hero:text-ink-2">
              <span className="min-w-0 underline-offset-4 group-hover/hero:underline decoration-[color-mix(in_oklch,var(--tone)_45%,transparent)]">
                {title}
              </span>
              <ChevronDown className="size-4 shrink-0 text-ink-4 transition-colors group-hover/hero:text-ink-2" />
            </h3>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0" sideOffset={6}>
          <Command>
            <CommandInput placeholder="Search the catalog…" />
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

      {/* One split control: the gold face logs, the tail picks the date. */}
      <div
        className={cn(
          "btn-illuminated flex h-10 w-full items-stretch overflow-hidden rounded-(--sd-r-md)",
          (isPending || !configured) && "pointer-events-none opacity-50"
        )}
      >
        <button
          ref={logButtonRef}
          className="t-label flex flex-1 items-center justify-center gap-1.5 px-3"
          disabled={isPending || !configured}
          onClick={logStudy}
          type="button"
        >
          <BookOpenText className="size-4" />
          Log as studied · {dateLabel ?? formatPillDate(studyDate)}
        </button>
        <span aria-hidden className="my-1.5 w-px self-stretch bg-brand-ink/30" />
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Change the study date"
              className="flex items-center px-3 transition-[background] hover:bg-brand-ink/10"
              disabled={isPending || !configured}
              type="button"
            >
              <ChevronDown className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                {[
                  ["Today", today],
                  ["Yesterday", yesterday],
                ].map(([optionLabel, optionValue]) => (
                  <button
                    key={optionLabel}
                    className={cn(
                      "t-label rounded-(--sd-r-sm) border border-line px-2.5 py-1.5 transition-colors hover:border-line-strong",
                      studyDate === optionValue && "border-brand text-brand"
                    )}
                    onClick={() => {
                      setStudyDate(optionValue);
                      setDateOpen(false);
                    }}
                    type="button"
                  >
                    {optionLabel}
                  </button>
                ))}
              </div>
              <input
                aria-label="Study date"
                className="t-body-sm rounded-(--sd-r-sm) border border-line bg-surface px-2.5 py-1.5 text-ink shadow-(--sd-shadow-well)"
                max={today}
                onChange={(event) => {
                  if (event.target.value) {
                    setStudyDate(event.target.value);
                    setDateOpen(false);
                  }
                }}
                type="date"
                value={studyDate}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
