"use client";

import { useMemo, useState } from "react";

import type { BoardPerson, BoardProfile } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Stage } from "@/lib/stages";

import { daysInPipeline, formatMonthLabel, monthKey } from "../lib/format";
import { isLegacyOrCurrentBaptizedStage } from "../lib/move-preview";
import { LedgerStat } from "../primitives/ledger-stat";
import { SectionHeading } from "../primitives/section-heading";
import { LifeStatusReport, StageDistribution } from "./stage-distribution";
import { TrendChart, type TrendPoint } from "./trend-chart";

type AlmanacDialogProps = {
  open: boolean;
  people: BoardPerson[];
  profiles: BoardProfile[];
  stages: Stage[];
  onClose: () => void;
};

/**
 * The Almanac: the month's record set like a printed broadsheet — mono
 * eyebrows, serif numerals, hairline rules, and ink-drawn charts whose
 * colors come from the validated stage tones.
 */
export function AlmanacDialog({
  open,
  people,
  profiles,
  stages,
  onClose,
}: AlmanacDialogProps) {
  const [monthFilter, setMonthFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const monthOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...people.map((person) => monthKey(person.created_at)),
          ...people.flatMap((person) =>
            person.studies.map((study) => monthKey(study.studied_at ?? study.created_at))
          ),
        ])
      ).sort((a, b) => b.localeCompare(a)),
    [people]
  );

  const filteredPeople = useMemo(
    () =>
      people.filter((person) => {
        const matchesMonth =
          monthFilter === "all" || monthKey(person.created_at) === monthFilter;
        const matchesUser =
          userFilter === "all" || person.assigned_profile_ids.includes(userFilter);

        return matchesMonth && matchesUser;
      }),
    [monthFilter, people, userFilter]
  );

  const stageRows = stages.map((stage) => ({
    stage,
    count: filteredPeople.filter((person) => person.stage === stage.id).length,
  }));
  const total = filteredPeople.length;
  const filteredStudies = filteredPeople.flatMap((person) =>
    person.studies.filter(
      (study) =>
        monthFilter === "all" ||
        monthKey(study.studied_at ?? study.created_at) === monthFilter
    )
  );
  const averageDays =
    total === 0
      ? 0
      : Math.round(
          filteredPeople.reduce(
            (sum, person) => sum + daysInPipeline(person.created_at),
            0
          ) / total
        );
  const baptizedCount = filteredPeople.filter((person) =>
    isLegacyOrCurrentBaptizedStage(person.stage)
  ).length;
  const workerCount = filteredPeople.filter(
    (person) => person.life_status === "worker"
  ).length;
  const studentCount = filteredPeople.filter(
    (person) => person.life_status === "student"
  ).length;
  const activeUserCount = profiles.filter((profile) =>
    filteredPeople.some((person) => person.assigned_profile_ids.includes(profile.id))
  ).length;

  const matchesUserFilter = (person: BoardPerson) =>
    userFilter === "all" || person.assigned_profile_ids.includes(userFilter);
  const trendMonths =
    monthFilter === "all" ? monthOptions.slice(0, 6).reverse() : [monthFilter];
  const trendData: TrendPoint[] = (
    trendMonths.length > 0 ? trendMonths : [monthKey(new Date().toISOString())]
  ).map((month) => ({
    month,
    contacts: people.filter(
      (person) => matchesUserFilter(person) && monthKey(person.created_at) === month
    ).length,
    studies: people
      .filter(matchesUserFilter)
      .flatMap((person) => person.studies)
      .filter((study) => monthKey(study.studied_at ?? study.created_at) === month)
      .length,
  }));

  const userRows = profiles
    .map((profile) => {
      const theirPeople = filteredPeople.filter((person) =>
        person.assigned_profile_ids.includes(profile.id)
      );
      const theirStudies = theirPeople.flatMap((person) =>
        person.studies.filter(
          (study) =>
            monthFilter === "all" ||
            monthKey(study.studied_at ?? study.created_at) === monthFilter
        )
      );

      return {
        profile,
        contacts: theirPeople.length,
        studies: theirStudies.length,
        averageDays:
          theirPeople.length === 0
            ? 0
            : Math.round(
                theirPeople.reduce(
                  (sum, person) => sum + daysInPipeline(person.created_at),
                  0
                ) / theirPeople.length
              ),
      };
    })
    .filter((row) => row.contacts > 0 || userFilter === row.profile.id)
    .sort((a, b) => b.contacts - a.contacts);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden border-line bg-surface-raised p-0">
        <DialogDescription className="sr-only">
          Monthly statistics for the board.
        </DialogDescription>

        {/* Masthead of the broadsheet */}
        <header className="gilt-wash-head flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 pb-4 pt-6">
          <div>
            <DialogTitle className="t-display-lg text-gilt italic">
              Data
            </DialogTitle>
            <p className="t-meta mt-1.5 text-ink-3">
              {monthFilter === "all" ? "All recorded months" : formatMonthLabel(monthFilter)}
              {userFilter !== "all"
                ? ` · ${profiles.find((profile) => profile.id === userFilter)?.name ?? ""}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger aria-label="Month" className="t-body-sm h-9 w-36 border-line bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="t-body-sm" value="all">
                  All months
                </SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month} className="t-body-sm" value={month}>
                    {formatMonthLabel(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger aria-label="Worker" className="t-body-sm h-9 w-36 border-line bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="t-body-sm" value="all">
                  All workers
                </SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} className="t-body-sm" value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-5">
          {/* The tallies */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
            <LedgerStat label="Contacts" value={total} />
            <LedgerStat label="Studies" value={filteredStudies.length} />
            <LedgerStat label="Avg days" value={averageDays} tone="muted" />
            <LedgerStat
              label="Baptized"
              value={baptizedCount}
              tone={baptizedCount > 0 ? "joy" : "muted"}
            />
            <LedgerStat label="Active workers" value={activeUserCount} tone="muted" />
          </div>

          {/* The journey, measured */}
          <section className="flex flex-col gap-3.5">
            <SectionHeading>The pipeline</SectionHeading>
            <StageDistribution rows={stageRows} />
          </section>

          <section className="flex flex-col gap-3.5">
            <SectionHeading>Workers &amp; students</SectionHeading>
            <LifeStatusReport workers={workerCount} students={studentCount} />
          </section>

          <section className="flex flex-col gap-3.5">
            <SectionHeading>The months</SectionHeading>
            <TrendChart data={trendData} />
          </section>

          {/* The register, per worker */}
          <section className="flex flex-col gap-3.5">
            <SectionHeading>By worker</SectionHeading>
            {userRows.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th className="t-meta-sm py-2 text-left font-normal text-ink-4">
                      Worker
                    </th>
                    <th className="t-meta-sm py-2 text-right font-normal text-ink-4">
                      Contacts
                    </th>
                    <th className="t-meta-sm py-2 text-right font-normal text-ink-4">
                      Studies
                    </th>
                    <th className="t-meta-sm py-2 text-right font-normal text-ink-4">
                      Avg days
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userRows.map((row) => (
                    <tr key={row.profile.id} className="border-b border-line last:border-0">
                      <td className="t-body-sm py-2 text-ink">{row.profile.name}</td>
                      <td className="t-meta py-2 text-right tabular-nums text-ink">
                        {row.contacts}
                      </td>
                      <td className="t-meta py-2 text-right tabular-nums text-ink">
                        {row.studies}
                      </td>
                      <td className="t-meta py-2 text-right tabular-nums text-ink-3">
                        {row.averageDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="t-body-sm italic text-ink-3">
                No assigned contacts in this view.
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
