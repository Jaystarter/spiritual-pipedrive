"use client";

import { CalendarClock, MoonStar, UserRoundPlus } from "lucide-react";

import type {
  AssignmentNotificationItem,
  FollowUpItem,
} from "@/components/board/types";
import { SectionHeading } from "@/components/board/primitives/section-heading";
import { PersonFramedAvatar } from "@/components/board/primitives/framed-avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { PushReminderToggle } from "@/components/notifications/push-reminder-toggle";
import { cn } from "@/lib/utils";

type AttentionDrawerProps = {
  open: boolean;
  activeProfileId: string;
  followUpItems: FollowUpItem[];
  assignmentItems: AssignmentNotificationItem[];
  onClose: () => void;
  onSelectPerson: (personId: string) => void;
};

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function AttentionRow({
  item,
  urgent,
  onSelect,
}: {
  item: FollowUpItem;
  urgent: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        className="flex w-full items-center gap-3 rounded-(--sd-r-md) px-2 py-2 text-left transition-colors hover:bg-surface-sunken/70"
        onClick={onSelect}
        type="button"
      >
        <PersonFramedAvatar person={item.person} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="t-display-sm block truncate text-ink">
            {item.person.name}
          </span>
          <span className="t-meta-sm mt-0.5 block truncate text-ink-4">
            {item.stageLabel} · last: {item.latestActivity.label}
          </span>
        </span>
        <span
          className={cn(
            "t-meta-sm shrink-0 tabular-nums",
            urgent ? "text-signal-urgent" : "text-signal-wane"
          )}
        >
          {urgent ? `Missed ${formatShortDate(item.missedAt)}` : `${item.daysQuiet}d quiet`}
        </span>
      </button>
    </li>
  );
}

/**
 * "Needs attention" — the persistent home of urgency, opened from the bell.
 */
export function AttentionDrawer({
  open,
  activeProfileId,
  followUpItems,
  assignmentItems,
  onClose,
  onSelectPerson,
}: AttentionDrawerProps) {
  // getMissedFollowUpDate upstream sets missedAt to the person's
  // next_follow_up_at ONLY when that planned date has already passed —
  // so equality is the "missed a set follow-up" signal (no clock needed).
  const missed = followUpItems.filter(
    (item) =>
      item.person.next_follow_up_at !== null &&
      item.missedAt === item.person.next_follow_up_at
  );
  const missedIds = new Set(missed.map((item) => item.person.id));
  const goingQuiet = followUpItems.filter((item) => !missedIds.has(item.person.id));

  function choose(personId: string) {
    onSelectPerson(personId);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className="flex w-full flex-col gap-0 border-line bg-surface-raised p-0 sm:max-w-[420px]"
        side="right"
      >
        <div className="gilt-wash-head border-b border-line px-5 pb-4 pt-5">
          <SheetTitle className="t-display-md text-ink">Needs attention</SheetTitle>
          <SheetDescription className="t-body-sm mt-1 text-ink-3">
            The souls waiting on you, quietest first.
          </SheetDescription>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          {followUpItems.length === 0 && assignmentItems.length === 0 ? (
            <p className="t-body-sm px-2 italic text-ink-3">
              All quiet — no one is waiting on you today.
            </p>
          ) : null}

          {missed.length > 0 ? (
            <section className="flex flex-col gap-2">
              <SectionHeading className="px-2">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-3" />
                  Missed follow-ups
                </span>
              </SectionHeading>
              <ul className="flex flex-col">
                {missed.map((item) => (
                  <AttentionRow
                    key={item.person.id}
                    item={item}
                    urgent
                    onSelect={() => choose(item.person.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {goingQuiet.length > 0 ? (
            <section className="flex flex-col gap-2">
              <SectionHeading className="px-2">
                <span className="flex items-center gap-1.5">
                  <MoonStar className="size-3" />
                  Going quiet
                </span>
              </SectionHeading>
              <ul className="flex flex-col">
                {goingQuiet.map((item) => (
                  <AttentionRow
                    key={item.person.id}
                    item={item}
                    urgent={false}
                    onSelect={() => choose(item.person.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {assignmentItems.length > 0 ? (
            <section className="flex flex-col gap-2">
              <SectionHeading className="px-2">
                <span className="flex items-center gap-1.5">
                  <UserRoundPlus className="size-3" />
                  Assigned to you
                </span>
              </SectionHeading>
              <ul className="flex flex-col">
                {assignmentItems.map((item) => (
                  <li key={item.event.id}>
                    <button
                      className="flex w-full items-center gap-3 rounded-(--sd-r-md) px-2 py-2 text-left transition-colors hover:bg-surface-sunken/70"
                      onClick={() => choose(item.person.id)}
                      type="button"
                    >
                      <PersonFramedAvatar person={item.person} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="t-display-sm block truncate text-ink">
                          {item.person.name}
                        </span>
                        <span className="t-meta-sm mt-0.5 block truncate text-ink-4">
                          {item.actorProfile
                            ? `Assigned by ${item.actorProfile.name}`
                            : "Assigned to you"}{" "}
                          · {formatShortDate(item.event.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="border-t border-line px-5 py-4">
          <PushReminderToggle activeProfileId={activeProfileId} />
        </footer>
      </SheetContent>
    </Sheet>
  );
}
