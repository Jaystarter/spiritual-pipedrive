"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Phone } from "lucide-react";

import {
  addContactReaction,
  type BoardPerson,
  type ContactReactionChannel,
  type ContactReactionOutcome,
} from "@/app/actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useBoardActions, useBoardData } from "../board-context";

const OUTCOMES: Record<
  ContactReactionChannel,
  ReadonlyArray<readonly [ContactReactionOutcome, string]>
> = {
  text: [
    ["responded", "Replied"],
    ["no_response", "No reply"],
  ],
  call: [
    ["picked_up", "Picked up"],
    ["missed", "Missed"],
  ],
};

/**
 * The touch logger: TEXT / CALL, then an outcome chip — two taps to record a
 * reach-out. Radix Popover anchors it properly.
 */
export function TouchLogger({
  person,
  className,
  size = "compact",
}: {
  person: BoardPerson;
  className?: string;
  size?: "compact" | "full";
}) {
  const { activeProfile, configured } = useBoardData();
  const actions = useBoardActions();
  const [openChannel, setOpenChannel] = useState<ContactReactionChannel | null>(null);
  const [isPending, startTransition] = useTransition();

  function logReaction(channel: ContactReactionChannel, outcome: ContactReactionOutcome) {
    if (!configured) {
      actions.onNotice("Connect Supabase before logging contact reactions.");
      return;
    }

    if (!activeProfile) {
      actions.onNotice("Choose your profile before logging contact reactions.");
      return;
    }

    startTransition(async () => {
      const result = await addContactReaction({
        id: person.id,
        channel,
        outcome,
        actorProfileId: activeProfile.id,
      });

      if (!result.ok || !result.data) {
        actions.onNotice(result.ok ? "The reaction could not be logged." : result.error);
        return;
      }

      actions.onReactionLogged(person.id, result.data);
      actions.onNotice(undefined);
      setOpenChannel(null);
    });
  }

  const iconSize = size === "compact" ? "size-3.5" : "size-4";
  const buttonSize = size === "compact" ? "size-7" : "size-9";

  return (
    <div
      className={cn(
        "flex items-center overflow-hidden rounded-(--sd-r-sm) border border-line bg-surface-raised",
        className
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {(["text", "call"] as const).map((channel, index) => (
        <Popover
          key={channel}
          open={openChannel === channel}
          onOpenChange={(open) => setOpenChannel(open ? channel : null)}
        >
          <PopoverTrigger asChild>
            <button
              aria-label={channel === "text" ? "Log a text" : "Log a call"}
              className={cn(
                "flex items-center justify-center text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
                buttonSize,
                index > 0 && "border-l border-line",
                openChannel === channel && "bg-surface-sunken text-brand"
              )}
              disabled={isPending}
              type="button"
            >
              {channel === "text" ? (
                <MessageCircle className={iconSize} />
              ) : (
                <Phone className={iconSize} />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-1.5" sideOffset={6}>
            <div className="flex items-center gap-1.5">
              <span className="t-meta-sm px-1 text-ink-4">
                {channel === "text" ? "Text" : "Call"}
              </span>
              {OUTCOMES[channel].map(([outcome, label]) => (
                <button
                  key={outcome}
                  className={cn(
                    "t-label rounded-(--sd-r-sm) border border-line px-2.5 py-1.5 transition-colors",
                    "hover:border-line-strong hover:bg-surface-sunken disabled:opacity-50",
                    (outcome === "no_response" || outcome === "missed") &&
                      "text-signal-wane",
                    (outcome === "responded" || outcome === "picked_up") &&
                      "text-tone-green-ink"
                  )}
                  disabled={isPending}
                  onClick={() => logReaction(channel, outcome)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
