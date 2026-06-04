"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  disablePush,
  enablePush,
  getPushPermission,
  isPushEnabled,
  isPushSupported,
} from "@/lib/push-client";

type ToggleStatus = "loading" | "unsupported" | "denied" | "off" | "on";

type Feedback = { tone: "ok" | "error"; text: string } | null;

export function PushReminderToggle({
  activeProfileId,
  className,
}: {
  activeProfileId: string;
  className?: string;
}) {
  const [status, setStatus] = useState<ToggleStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveStatus() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (getPushPermission() === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      const enabled = await isPushEnabled();

      if (!cancelled) setStatus(enabled ? "on" : "off");
    }

    void resolveStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setBusy(true);
    setFeedback(null);

    const result = await enablePush(activeProfileId);

    setBusy(false);

    if (result.ok) {
      setStatus("on");
      setFeedback({ tone: "ok", text: "Reminders on for this device." });
      return;
    }

    if (getPushPermission() === "denied") {
      setStatus("denied");
    }

    setFeedback({
      tone: "error",
      text: result.error ?? "Could not enable reminders.",
    });
  }

  async function handleDisable() {
    setBusy(true);
    setFeedback(null);

    const result = await disablePush();

    setBusy(false);

    if (result.ok) {
      setStatus("off");
      setFeedback({ tone: "ok", text: "Reminders off for this device." });
      return;
    }

    setFeedback({
      tone: "error",
      text: result.error ?? "Could not turn off reminders.",
    });
  }

  const needsProfile = status === "off" && !activeProfileId;
  const disabled =
    busy ||
    status === "loading" ||
    status === "unsupported" ||
    status === "denied" ||
    needsProfile;

  let label: string;
  let icon = <Bell className="size-3.5 shrink-0" aria-hidden="true" />;

  if (status === "on") {
    label = busy ? "Turning off…" : "Reminders on";
    icon = <BellRing className="size-3.5 shrink-0" aria-hidden="true" />;
  } else if (status === "unsupported") {
    label = "Reminders unavailable";
    icon = <BellOff className="size-3.5 shrink-0" aria-hidden="true" />;
  } else if (status === "denied") {
    label = "Reminders blocked";
    icon = <BellOff className="size-3.5 shrink-0" aria-hidden="true" />;
  } else if (status === "loading") {
    label = "Checking reminders…";
  } else {
    label = busy ? "Turning on…" : "Turn on reminders";
  }

  const hint =
    status === "unsupported"
      ? "This browser can't show push reminders. On iPhone, add S-Drive to your Home Screen first."
      : status === "denied"
        ? "Notifications are blocked. Re-enable them in your browser settings."
        : needsProfile
          ? "Choose your profile first."
          : null;

  function handleClick() {
    if (status === "on") {
      void handleDisable();
    } else if (status === "off") {
      void handleEnable();
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={status === "on"}
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
          status === "on"
            ? "neu-accent-fill text-white"
            : "neu-raised-sm text-[var(--neu-text)] hover:-translate-y-0.5 hover:text-[var(--neu-accent)] active:translate-y-0 active:scale-95 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0"
        )}
      >
        {icon}
        <span>{label}</span>
      </button>
      {(feedback || hint) && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "text-[0.66rem] font-medium leading-4",
            feedback?.tone === "error"
              ? "text-rose-600"
              : feedback?.tone === "ok"
                ? "text-[var(--neu-accent)]"
                : "text-muted-foreground/80"
          )}
        >
          {feedback?.text ?? hint}
        </p>
      )}
    </div>
  );
}
