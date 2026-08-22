"use client";

import { useRef, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { acknowledgePerson, type BoardPerson } from "@/app/actions";
import { isAcknowledged } from "@/lib/follow-ups";
import { cn } from "@/lib/utils";

import { useBoardActions } from "../board-context";
import { formatDate } from "../lib/format";

/** How far the row travels, and how far it must go to commit. */
const TRAVEL = 96;
const COMMIT_DISTANCE = 56;
const COMMIT_VELOCITY = 420;

/**
 * Swipe a row left to say "I've seen this one".
 *
 * The phone board (The Path) is a list of chromeless rows, so a thumb swipe is
 * the cheapest possible triage: no small target to hit, no sheet to open. Rows
 * here have dnd disabled, so there is no gesture to race.
 *
 * Swiping an acknowledged row clears it again, which is the undo path.
 */
export function SwipeToAcknowledge({
  person,
  children,
}: {
  person: BoardPerson;
  children: React.ReactNode;
}) {
  const actions = useBoardActions();
  const prefersReducedMotion = useReducedMotion();
  const [isSaving, startSaving] = useTransition();
  const [committed, setCommitted] = useState(false);
  // A swipe ends with a click event the row would read as "open this person".
  const swipedRef = useRef(false);

  const acknowledged = isAcknowledged(person);

  function commit() {
    const actorProfileId = actions.requireActiveProfile();

    if (!actorProfileId || isSaving) {
      return;
    }

    setCommitted(true);
    startSaving(async () => {
      const result = await acknowledgePerson({
        id: person.id,
        // "" clears; omitting it takes the default quiet window.
        ...(acknowledged ? { until: "" } : {}),
        actorProfileId,
      });

      setCommitted(false);

      if (!result.ok) {
        actions.onNotice(result.error);
        return;
      }

      const data = result.data;

      if (!data) {
        return;
      }

      actions.onAcknowledged(person.id, data.event, data.nextFollowUpAt);
      actions.onNotice(
        data.nextFollowUpAt
          ? `Seen. ${person.name} returns ${formatDate(data.nextFollowUpAt)}.`
          : `${person.name} is waiting on you again.`
      );
    });
  }

  return (
    <div className="relative overflow-hidden">
      {/* The promise waiting behind the row. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end pr-4",
          "w-full"
        )}
        style={{
          background:
            "linear-gradient(to left, color-mix(in oklch, var(--sd-accent) 16%, transparent), transparent 60%)",
        }}
      >
        <span
          className="t-meta-sm uppercase tracking-wide"
          style={{ color: "var(--sd-accent)" }}
        >
          {acknowledged ? "Waiting" : "Seen"}
        </span>
      </div>

      <motion.div
        className="relative bg-surface"
        style={{ touchAction: "pan-y" }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -TRAVEL, right: 0 }}
        dragElastic={prefersReducedMotion ? 0 : 0.12}
        dragMomentum={false}
        animate={{ x: committed ? -TRAVEL : 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.28 }
        }
        onDragStart={() => {
          swipedRef.current = false;
        }}
        onDrag={(_, info) => {
          if (Math.abs(info.offset.x) > 6) {
            swipedRef.current = true;
          }
        }}
        onDragEnd={(_, info) => {
          const far = info.offset.x <= -COMMIT_DISTANCE;
          const fast = info.velocity.x <= -COMMIT_VELOCITY;

          if (far || fast) {
            commit();
          }
        }}
        onClickCapture={(event) => {
          // Swallow the click a completed swipe would otherwise deliver.
          if (swipedRef.current) {
            event.preventDefault();
            event.stopPropagation();
            swipedRef.current = false;
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
