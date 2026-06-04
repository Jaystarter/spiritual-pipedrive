"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BellRing, ChevronRight, Phone, X } from "lucide-react";

/**
 * Minimum number of overdue follow-ups required before the reminder auto-pops.
 * Bump this if a single overdue contact ever feels too noisy.
 */
const REMINDER_MIN_ITEMS = 1;

/** How many overdue contacts to list before collapsing the rest into "+N more". */
const REMINDER_LIST_LIMIT = 6;

/**
 * sessionStorage key prefix. The full key is
 * `followup-reminder-shown:{profileId}:{YYYY-MM-DD}` so the popup shows at most
 * once per profile, per day, per browser session and never re-pops on a refresh
 * or in-app navigation within that session.
 */
const SHOWN_STORAGE_PREFIX = "followup-reminder-shown:";

/**
 * Structural shape of a single overdue follow-up row. This is intentionally a
 * subset of the board's `FollowUpItem` so the board can pass its items straight
 * through without exporting its (large) client module's internal types.
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
    // sessionStorage may be unavailable (private mode / blocked). The reminder
    // simply falls back to showing again next load; never throw on this path.
  }
}

function formatReminderDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function LoginReminder({
  activeProfileId,
  activeProfileName,
  items,
  onOpenNotifications,
}: LoginReminderProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const itemCount = items.length;

  // Decide whether to auto-show. Re-runs on mount and whenever the active
  // profile or its overdue count changes (i.e. when the user switches profiles).
  // The state update is deferred to the next frame to avoid synchronous setState
  // in an effect body (matches the board's mount pattern).
  useEffect(() => {
    if (!activeProfileId || itemCount < REMINDER_MIN_ITEMS) {
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

  // Move focus into the dialog on open and return it to the trigger on close.
  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  function dismiss() {
    if (activeProfileId) {
      markShown(reminderStorageKey(activeProfileId));
    }

    setOpen(false);
  }

  function handleOpenNotifications() {
    dismiss();
    onOpenNotifications();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const container = dialogRef.current;

    if (!container) {
      return;
    }

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || active === container) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  const visibleItems = items.slice(0, REMINDER_LIST_LIMIT);
  const remainingCount = Math.max(0, items.length - visibleItems.length);
  const subline =
    itemCount === 1
      ? "You have 1 contact who needs a follow-up."
      : `You have ${itemCount} contacts who need a follow-up.`;

  const backdropTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.2, ease: "easeOut" as const };
  const panelInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 48, scale: 0.97 };
  const panelAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };
  const panelExit = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 32, scale: 0.97 };
  const panelTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        >
          <motion.button
            aria-label="Dismiss follow-up reminder"
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={dismiss}
            type="button"
          />
          <motion.div
            ref={dialogRef}
            className="neu-raised relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto p-5 focus-visible:outline-none sm:p-6"
            style={{ borderRadius: "1.75rem", background: "var(--neu-bg)" }}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={panelTransition}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-reminder-title"
            aria-describedby="login-reminder-subline"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="neu-pressed inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--neu-accent)]"
              >
                <BellRing className="size-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[var(--neu-accent)]">
                  Reminder
                </p>
                <h2
                  id="login-reminder-title"
                  className="mt-0.5 font-display text-2xl leading-tight tracking-display text-[var(--neu-text-strong)]"
                >
                  Follow-ups waiting for you
                </h2>
                <p
                  id="login-reminder-subline"
                  className="mt-1 text-[0.82rem] font-medium leading-5 text-[var(--neu-text-muted)]"
                >
                  {activeProfileName ? `${activeProfileName}, ` : ""}
                  {subline}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close reminder"
                onClick={dismiss}
                className="neu-raised-sm inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 motion-reduce:transition-none"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="mt-4 flex flex-col gap-2.5 text-[0.78rem] leading-5 text-[var(--neu-text-muted)]">
              {visibleItems.map((item) => (
                <li
                  key={`reminder-${item.person.id}`}
                  className="neu-inset-card flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2.5"
                >
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-sky-700"
                    aria-label={`Missed on ${formatReminderDate(item.missedAt)}`}
                  >
                    <Phone className="size-3 shrink-0" aria-hidden="true" strokeWidth={2.4} />
                    <time className="shrink-0" dateTime={item.missedAt}>
                      MISSED · {formatReminderDate(item.missedAt)}
                    </time>
                  </span>
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-sky-500" />
                  <span className="min-w-0 truncate font-bold text-[var(--neu-text-strong)]">
                    {item.person.name}
                  </span>
                  <span className="shrink-0">needs follow-up</span>
                  <span className="shrink-0 text-[var(--neu-text-muted)]/75">
                    ({item.daysQuiet}d quiet)
                  </span>
                </li>
              ))}
              {remainingCount > 0 ? (
                <li className="flex items-center gap-1.5 pl-1 text-[0.74rem] font-semibold text-[var(--neu-text-muted)]/80">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--neu-text-muted)]/45" />
                  +{remainingCount} more
                </li>
              ) : null}
            </ul>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={dismiss}
                className="neu-raised-sm inline-flex items-center justify-center rounded-full px-4 py-2.5 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[var(--neu-text)] transition hover:-translate-y-0.5 hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:translate-y-0 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleOpenNotifications}
                className="neu-accent-fill inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)] active:translate-y-0 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Open To-Do list
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
