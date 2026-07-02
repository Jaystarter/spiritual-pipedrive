"use client";

import { ArrowUpRight } from "lucide-react";

import type { BoardPerson, BoardProfile } from "@/app/actions";
import { Button } from "@/components/ui/button";

import { LedgerStat } from "../primitives/ledger-stat";

type LedgerStripProps = {
  people: BoardPerson[];
  activeProfile: BoardProfile | null;
  attentionCount: number;
  onOpenGraphs: () => void;
  onOpenNotifications: () => void;
};

/**
 * The folio line under the masthead: the working profile's tallies set like
 * a printed broadsheet, with the Almanac a page-turn away.
 */
export function LedgerStrip({
  people,
  activeProfile,
  attentionCount,
  onOpenGraphs,
  onOpenNotifications,
}: LedgerStripProps) {
  const activeCount =
    activeProfile?.active_contacts ??
    people.filter((person) => !person.archived_at && person.stage !== "archive").length;
  const baptizedThisMonth = activeProfile?.baptized_this_month ?? 0;

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex items-end gap-6 sm:gap-8">
        <LedgerStat
          label={activeProfile ? `${activeProfile.name}’s contacts` : "Active contacts"}
          value={activeCount}
        />
        <div aria-hidden className="h-10 w-px bg-gradient-to-b from-transparent via-line-strong to-transparent" />
        <LedgerStat
          label="Baptized this month"
          value={baptizedThisMonth}
          tone={baptizedThisMonth > 0 ? "joy" : "muted"}
        />
        <div aria-hidden className="h-10 w-px bg-gradient-to-b from-transparent via-line-strong to-transparent" />
        <button className="text-left" onClick={onOpenNotifications} type="button">
          <LedgerStat
            label="Needs attention"
            value={attentionCount}
            tone={attentionCount > 0 ? "urgent" : "muted"}
          />
        </button>
      </div>

      <Button
        className="t-meta gap-1 self-end text-ink-3 underline-offset-4 hover:text-brand hover:underline"
        onClick={onOpenGraphs}
        variant="ghost"
      >
        The Almanac
        <ArrowUpRight className="size-3.5" />
      </Button>
    </section>
  );
}
