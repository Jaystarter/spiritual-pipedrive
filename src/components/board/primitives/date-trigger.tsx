"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateQuickOption = {
  label: string;
  value: string;
};

type DateTriggerProps = {
  /** Date-only value (YYYY-MM-DD) or empty/null for unset. */
  value: string | null;
  /** Called with a date value, or "" when cleared. */
  onChange: (dateValue: string) => void;
  /** Pill text prefix when a date is set, e.g. "Follow up". */
  label: string;
  /** Pill text when no date is set, e.g. "Set follow-up". */
  placeholder: string;
  quickOptions: DateQuickOption[];
  allowClear?: boolean;
  max?: string;
  min?: string;
  /** Overdue state: the pill wears the urgent signal. */
  urgent?: boolean;
  /** Icon-only pill (plus the short date once one is set). */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
};

export function formatPillDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

/**
 * The ledger's date control: a quiet pill that opens quick choices plus a
 * calendar field — one pattern for follow-up dates and study dates alike.
 * (Retires the naked native date input.)
 */
export function DateTrigger({
  value,
  onChange,
  label,
  placeholder,
  quickOptions,
  allowClear = false,
  max,
  min,
  urgent = false,
  compact = false,
  disabled = false,
  className,
}: DateTriggerProps) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? value.slice(0, 10) : "";

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "t-label flex h-8 items-center gap-1.5 rounded-(--sd-r-pill) border px-3 transition-colors",
            urgent
              ? "border-signal-urgent/45 text-signal-urgent"
              : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
            disabled && "pointer-events-none opacity-50",
            className
          )}
          aria-label={dateValue ? `${label} · ${formatPillDate(dateValue)}` : placeholder}
          disabled={disabled}
          type="button"
        >
          <CalendarClock className="size-3.5" />
          {compact
            ? dateValue
              ? formatPillDate(dateValue)
              : null
            : dateValue
              ? `${label} · ${formatPillDate(dateValue)}`
              : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            {quickOptions.map((option) => (
              <button
                key={option.label}
                className={cn(
                  "t-label rounded-(--sd-r-sm) border border-line px-2.5 py-1.5 transition-colors hover:border-line-strong",
                  dateValue === option.value && "border-brand text-brand"
                )}
                onClick={() => choose(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            aria-label={label}
            className="t-body-sm rounded-(--sd-r-sm) border border-line bg-surface px-2.5 py-1.5 text-ink shadow-(--sd-shadow-well)"
            max={max}
            min={min}
            onChange={(event) => {
              if (event.target.value) {
                choose(event.target.value);
              }
            }}
            type="date"
            value={dateValue}
          />
          {allowClear && dateValue ? (
            <Button
              className="t-label self-end text-ink-4"
              onClick={() => choose("")}
              size="xs"
              variant="ghost"
            >
              Clear date
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
