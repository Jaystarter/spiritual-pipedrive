"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpenText, Sparkles, UserRoundPlus } from "lucide-react";

import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board/board-context";

const TOUR_DONE_PREFIX = "sd-first-contact-tour-done:";

function isTourDone(profileId: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(TOUR_DONE_PREFIX + profileId) === "1";
}

function markTourDone(profileId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOUR_DONE_PREFIX + profileId, "1");
}

/**
 * A gentle three-step walkthrough for workers at the field locations
 * (everywhere except the hub): welcome them to their region's board, walk
 * them into adding their first contact, then explain the card they just
 * made. Never shown to a worker who already has contacts, and never twice.
 */
export function FirstContactTour() {
  const { activeProfile, activeRegion, configured } = useBoardData();

  if (
    !configured ||
    !activeProfile ||
    !activeRegion ||
    activeRegion.is_hub === true
  ) {
    return null;
  }

  // A fresh instance per worker, so each one's starting state is captured
  // exactly once (and switching workers restarts the decision cleanly).
  return (
    <TourSteps
      key={activeProfile.id}
      profileId={activeProfile.id}
      regionName={activeRegion.name}
    />
  );
}

function TourSteps({
  profileId,
  regionName,
}: {
  profileId: string;
  regionName: string;
}) {
  const { people } = useBoardData();
  const actions = useBoardActions();
  const myContacts = useMemo(
    () => people.filter((person) => person.created_by_profile_id === profileId),
    [people, profileId]
  );
  // Veterans — a finished tour, or contacts already in the book — opt out at
  // mount. Everything after that is user-driven or derived, never synced.
  const [dismissed, setDismissed] = useState(
    () => isTourDone(profileId) || myContacts.length > 0
  );
  const [advanced, setAdvanced] = useState(false);

  const step = dismissed
    ? null
    : myContacts.length > 0
      ? "done"
      : advanced
        ? "add"
        : "welcome";

  if (!step) {
    return null;
  }

  function finish() {
    markTourDone(profileId);
    setDismissed(true);
  }

  const firstContactName = myContacts[0]?.name;

  if (step === "welcome") {
    return (
      <div className="fixed inset-0 z-(--z-drawer) flex items-end justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="card-lit-2 w-full max-w-md rounded-(--sd-r-lg) border border-line bg-surface p-6"
        >
          <p className="t-meta text-ink-4">Welcome to Zion Drive</p>
          <h2 className="t-display-md mt-2 text-ink">
            This is the {regionName} board
          </h2>
          <p className="t-body mt-3 text-ink-2">
            Every person you meet while preaching lives here — from the first
            hello, through each Bible study, all the way to baptism. Your job
            is simple: when you meet someone, write them in.
          </p>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={finish}
              className="t-label text-ink-3 transition-colors hover:text-ink-2"
            >
              Skip the tour
            </button>
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className="btn-illuminated t-label flex h-10 items-center gap-2 rounded-(--sd-r-md) px-4"
            >
              <BookOpenText className="size-4" />
              Show me how
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "fixed inset-x-4 z-(--z-appbar) sm:inset-x-auto sm:right-6 sm:w-96",
          "bottom-24 sm:bottom-6"
        )}
      >
        <div className="card-lit-2 rounded-(--sd-r-lg) border border-line bg-surface p-5">
          {step === "add" ? (
            <>
              <p className="t-meta text-ink-4">Step 1 of 2</p>
              <h3 className="t-display-sm mt-1.5 text-ink">
                Add your first contact
              </h3>
              <p className="t-body-sm mt-2 text-ink-2">
                Met someone today? Their name is all you need — phone, notes,
                and studies can come later. It takes ten seconds.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={finish}
                  className="t-label text-ink-3 transition-colors hover:text-ink-2"
                >
                  I&rsquo;ll do it later
                </button>
                <button
                  type="button"
                  onClick={() => actions.openQuickAdd()}
                  className="btn-illuminated t-label flex h-10 items-center gap-2 rounded-(--sd-r-md) px-4"
                >
                  <UserRoundPlus className="size-4" />
                  Add a contact
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="t-meta flex items-center gap-1.5 text-ink-4">
                <Sparkles className="size-3.5 text-gilt" />
                That&rsquo;s the whole flow
              </p>
              <h3 className="t-display-sm mt-1.5 text-ink">
                {firstContactName
                  ? `${firstContactName} is in the book`
                  : "Your first contact is in the book"}
              </h3>
              <p className="t-body-sm mt-2 text-ink-2">
                Tap their card any time to log a study, a text, or a note.
                If three quiet days pass, their meter turns red — that&rsquo;s
                your nudge to follow up. That&rsquo;s all there is to it.
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={finish}
                  className="btn-illuminated t-label flex h-10 items-center rounded-(--sd-r-md) px-4"
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
