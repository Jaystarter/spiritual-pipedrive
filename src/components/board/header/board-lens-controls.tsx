"use client";

import { useState } from "react";
import {
  UserRoundCheck,
  VenusAndMars,
  type LucideIcon,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { GenderView } from "../lib/derive";

type LensOption<T extends string> = { id: T; label: string };

const GENDER_VIEWS: LensOption<GenderView>[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "all", label: "Everyone" },
];

const OWNERSHIP_VIEWS: LensOption<string>[] = [
  { id: "mine", label: "Mine" },
  { id: "all", label: "All" },
];

function LensRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: LensOption<T>[];
  value: string;
  onChange: (next: T) => void;
}) {
  return (
    <div
      aria-label={label}
      className="flex items-center gap-1 rounded-(--sd-r-md) bg-surface-sunken p-1"
      role="group"
    >
      {options.map((option) => (
        <button
          key={option.id}
          aria-pressed={value === option.id}
          className={cn(
            "t-label min-w-0 flex-1 rounded-(--sd-r-sm) px-3 py-2 transition-[background-color,color,box-shadow]",
            value === option.id
              ? "bg-surface text-brand shadow-(--sd-shadow-well)"
              : "text-ink-3 hover:text-ink"
          )}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LensIconControl<T extends string>({
  icon: Icon,
  label,
  description,
  options,
  value,
  valueLabel,
  filtered,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  options: LensOption<T>[];
  value: string;
  valueLabel: string;
  filtered: boolean;
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`${label} filter: ${valueLabel}`}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-(--sd-r-sm) bg-transparent sm:size-9",
            "transition-[color,transform] hover:-translate-y-0.5 hover:text-brand",
            filtered ? "text-brand" : "text-ink-3"
          )}
          title={`${label}: ${valueLabel}`}
          type="button"
        >
          <Icon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(18rem,calc(100vw-2rem))] space-y-3 p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        sideOffset={8}
      >
        <div className="px-1">
          <p className="t-label text-ink">{label}</p>
          <p className="t-body-sm mt-0.5 text-ink-3">{description}</p>
        </div>
        <LensRow
          label={`${label} filter`}
          options={options}
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function BoardLensControls({
  genderView,
  profileFilter,
  onGenderViewChange,
  onProfileFilterChange,
}: {
  genderView: GenderView;
  profileFilter: string;
  onGenderViewChange: (view: GenderView) => void;
  onProfileFilterChange: (filter: string) => void;
}) {
  const ownershipLabel =
    OWNERSHIP_VIEWS.find((option) => option.id === profileFilter)?.label ??
    "Profile";
  const genderLabel =
    GENDER_VIEWS.find((option) => option.id === genderView)?.label ??
    "Everyone";

  return (
    <div
      aria-label="Board filters"
      className="flex shrink-0 items-center gap-1.5"
      role="group"
    >
      <LensIconControl
        icon={UserRoundCheck}
        label="Contacts"
        description="Choose whose contacts appear."
        options={OWNERSHIP_VIEWS}
        value={profileFilter}
        valueLabel={ownershipLabel}
        filtered={profileFilter !== "all"}
        onChange={onProfileFilterChange}
      />
      <LensIconControl
        icon={VenusAndMars}
        label="Gender"
        description="Show male, female, or everyone."
        options={GENDER_VIEWS}
        value={genderView}
        valueLabel={genderLabel}
        filtered={genderView !== "all"}
        onChange={onGenderViewChange}
      />
    </div>
  );
}
