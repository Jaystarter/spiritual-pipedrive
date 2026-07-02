"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * sessionStorage key prefix. The full key is
 * `followup-reminder-shown:{profileId}:{YYYY-MM-DD}` so the banner shows at
 * most once per profile, per day, per browser session and never re-pops on a
 * refresh or in-app navigation within that session.
 */
const SHOWN_STORAGE_PREFIX = "followup-reminder-shown:";

/**
 * Structural shape of a single overdue follow-up row — a subset of the
 * board's FollowUpItem so it can pass its items straight through.
 */
export type LoginReminderItem = {
  person: { id: string; name: string };
  daysQuiet: number;
  missedAt: string;
  latestActivity: { label: string; value: string };
};

type LoginReminderProps = {
  activeProfileId: string;
  activeProfileName?: string | null;
  items: LoginReminderItem[];
  onOpenNotifications: () => void;
};

function todayStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function reminderStorageKey(profileId: string) {
  return `${SHOWN_STORAGE_PREFIX}${profileId}:${todayStamp()}`;
}

function hasBeenShown(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markShown(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage may be unavailable (private mode / blocked). The banner
    // simply shows again next load; never throw on this path.
  }
}

/**
 * The once-a-day greeting: a quiet hairline band under the masthead instead
 * of a modal takeover. Its call-to-action opens the persistent attention
 * drawer.
 */
export function LoginReminder({
  activeProfileId,
  activeProfileName,
  items,
  onOpenNotifications,
}: LoginReminderProps) {
  const [open, setOpen] = useState(false);
  const itemCount = items.length;

  useEffect(() => {
    if (!activeProfileId || itemCount < 1) {
      return;
    }

    const key = reminderStorageKey(activeProfileId);

    if (hasBeenShown(key)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      markShown(key);
      setOpen(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeProfileId, itemCount]);

  if (!open || itemCount === 0) {
    return null;
  }

  const names = items.slice(0, 2).map((item) => item.person.name);
  const remaining = itemCount - names.length;
  const summary =
    remaining > 0
      ? `${names.join(" and ")} and ${remaining} other${remaining === 1 ? "" : "s"}`
      : names.join(" and ");

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1840px] items-center gap-2.5 px-4 py-2 sm:px-6">
        <BellRing className="size-4 shrink-0 text-signal-wane" />
        <p className="t-body-sm min-w-0 flex-1 truncate text-ink-2">
          {activeProfileName ? `${activeProfileName} — ` : ""}
          <span className="italic">{summary}</span>{" "}
          {itemCount === 1 ? "is" : "are"} waiting on a follow-up.
        </p>
        <Button
          className="t-label shrink-0 text-brand hover:text-brand"
          onClick={() => {
            setOpen(false);
            onOpenNotifications();
          }}
          size="sm"
          variant="ghost"
        >
          Open the list
        </Button>
        <Button
          aria-label="Dismiss reminder"
          className="size-6 shrink-0 text-ink-4"
          onClick={() => setOpen(false)}
          size="icon-xs"
          variant="ghost"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
