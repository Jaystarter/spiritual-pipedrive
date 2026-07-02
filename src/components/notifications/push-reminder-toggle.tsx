"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

import { Switch } from "@/components/ui/switch";
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
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-ink-2">
          {icon}
          <span className="t-label">{label}</span>
        </span>
        <Switch
          aria-label="Daily follow-up reminders"
          checked={status === "on"}
          disabled={disabled}
          onCheckedChange={handleClick}
        />
      </label>
      {(feedback || hint) && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "t-meta-sm leading-4",
            feedback?.tone === "error"
              ? "text-signal-urgent"
              : feedback?.tone === "ok"
                ? "text-tone-green-ink"
                : "text-ink-4"
          )}
        >
          {feedback?.text ?? hint}
        </p>
      )}
    </div>
  );
}
