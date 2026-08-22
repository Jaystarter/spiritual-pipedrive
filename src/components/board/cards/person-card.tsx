"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";

import type { BoardPerson } from "@/app/actions";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board-context";
import {
  getArchiveReason,
  getAssignedProfiles,
} from "../lib/derive";
import { formatDate } from "../lib/format";
import { getToneStyle, toneVars } from "../lib/stage-theme";
import { getLatestCompletedStudy } from "../lib/studies";
import { AvatarStack } from "../primitives/avatar-stack";
import { PersonFramedAvatar } from "../primitives/framed-avatar";
import { StageRibbon } from "../primitives/stage-ribbon";
import { SwipeToAcknowledge } from "../primitives/swipe-to-acknowledge";
import { UrgencyMeter } from "../primitives/urgency-meter";

/** The registrar line: one composed mono string, never competing chips. */
export function RegistrarLine({
  person,
  stage,
  regionLabel,
}: {
  person: BoardPerson;
  stage: Stage;
  /** Origin region, shown only on the hub board where locations mix. */
  regionLabel?: string | null;
}) {
  const regionSuffix = regionLabel ? ` · ${regionLabel}` : "";

  if (stage.id === "archive") {
    const reason = getArchiveReason(person.events);

    return (
      <span className="t-body-sm truncate italic text-ink-3">
        {reason ?? "Set aside"}
      </span>
    );
  }

  if (stage.id === "brothers" || stage.id === "baptized") {
    return (
      <span className="t-meta-sm truncate text-tone-green-ink">
        Baptized {person.baptized_at ? formatDate(person.baptized_at) : ""}
        {regionSuffix}
      </span>
    );
  }

  const latestStudy = getLatestCompletedStudy(person.studies);

  if (!latestStudy) {
    return (
      <span className="t-meta-sm truncate text-signal-wane">
        No study yet{regionSuffix}
      </span>
    );
  }

  return (
    <span
      className="t-meta-sm truncate text-ink-3"
      title={`Study ${String(latestStudy.study_number).padStart(2, "0")}`}
    >
      {formatDate(latestStudy.studied_at ?? latestStudy.created_at)}
      {regionSuffix}
    </span>
  );
}

function LifeStatusGlyph({ status }: { status: BoardPerson["life_status"] }) {
  if (!status) {
    return null;
  }

  const isWorker = status === "worker";

  return (
    <span
      className={cn(
        "t-meta-sm inline-flex size-4 shrink-0 items-center justify-center rounded-full leading-none ring-1",
        isWorker
          ? "text-tone-amber-ink ring-tone-amber/45"
          : "text-tone-sky-ink ring-tone-sky/45"
      )}
      title={isWorker ? "Gospel worker" : "Bible student"}
    >
      {isWorker ? "W" : "S"}
    </span>
  );
}

type PersonCardProps = {
  person: BoardPerson;
  stage: Stage;
  sortableDisabled?: boolean;
  /**
   * Enables swipe-to-acknowledge. Only the stack view passes this: its rows
   * have dnd disabled, so a horizontal drag has nothing to race.
   */
  swipeable?: boolean;
};

/**
 * One glanceable, single-state card: tone sliver, portrait, serif name, the
 * registrar line, and the urgency meter. Tap anywhere opens the person;
 * hovering lets the stage's light in from the ribbon edge and reveals the
 * touch logger.
 */
export const PersonCard = memo(function PersonCard({
  person,
  stage,
  sortableDisabled = false,
  swipeable = false,
}: PersonCardProps) {
  const {
    profiles,
    regions,
    activeRegion,
    configured,
    isPending,
    celebratePersonId,
  } = useBoardData();
  const actions = useBoardActions();
  const tone = getToneStyle(stage.tone);
  const assignedProfiles = getAssignedProfiles(person, profiles);
  const journeyDone = stage.id === "brothers" || stage.id === "archive";
  // On the hub board every location's people mix, so name where each is from.
  const originRegion =
    activeRegion?.is_hub && person.region_id && person.region_id !== activeRegion.id
      ? regions.find((region) => region.id === person.region_id) ?? null
      : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: person.id,
    disabled: sortableDisabled || !configured || isPending,
  });

  const card = (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...toneVars(stage.tone),
      }}
      className={cn(
        "group relative flex min-h-16 cursor-pointer touch-manipulation select-none items-center gap-2.5 px-2.5 py-2",
        // The tone dawn: hovering a row lets the stage's light in from the ribbon edge.
        "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-28",
        "before:bg-gradient-to-r before:from-[color-mix(in_oklch,var(--tone)_9%,transparent)] before:to-transparent",
        "before:opacity-0 before:transition-opacity before:duration-(--dur-base) group-hover:before:opacity-100",
        isDragging && "z-(--z-card) opacity-40"
      )}
      onClick={() => actions.onSelect(person.id)}
      {...attributes}
      {...listeners}
    >
      <StageRibbon tone={stage.tone} size="sliver" className="min-h-10" />
      <PersonFramedAvatar person={person} size="sm" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="t-display-sm truncate text-ink">{person.name}</span>
          <LifeStatusGlyph status={person.life_status} />
        </span>
        <RegistrarLine
          person={person}
          stage={stage}
          regionLabel={originRegion?.name}
        />
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {!journeyDone ? <UrgencyMeter person={person} /> : null}
        <AvatarStack profiles={assignedProfiles} />
      </div>

      {/* The baptism moment: a single expanding ring in living green. */}
      <AnimatePresence>
        {celebratePersonId === person.id ? (
          <motion.span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0.5 rounded-(--sd-r-md) ring-2",
              tone.ring
            )}
            style={{ ["--tw-ring-color" as string]: "var(--tone-green-core)" }}
            initial={{ opacity: 0.9, scale: 0.96 }}
            animate={{ opacity: 0, scale: 1.06 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );

  if (!swipeable) {
    return card;
  }

  return <SwipeToAcknowledge person={person}>{card}</SwipeToAcknowledge>;
});
