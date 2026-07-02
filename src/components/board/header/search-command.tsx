"use client";

import { Check, Filter } from "lucide-react";

import type { BoardPerson, BoardProfile } from "@/app/actions";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Stage } from "@/lib/stages";

import { displayStageCopy, getStageById } from "../lib/derive";
import { getToneStyle } from "../lib/stage-theme";
import { FramedAvatar, PersonFramedAvatar } from "../primitives/framed-avatar";

type SearchCommandProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: BoardPerson[];
  stages: Stage[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  profileFilter: string;
  onProfileFilterChange: (filter: string) => void;
  onSelectContact: (personId: string) => void;
};

/**
 * The ⌘K palette: find any name in the book, or point the whole board at a
 * profile. Replaces the old header search pop-over + profile filter tabs.
 */
export function SearchCommand({
  open,
  onOpenChange,
  people,
  stages,
  profiles,
  activeProfile,
  profileFilter,
  onProfileFilterChange,
  onSelectContact,
}: SearchCommandProps) {
  function choosePerson(personId: string) {
    onSelectContact(personId);
    onOpenChange(false);
  }

  function chooseFilter(filter: string) {
    onProfileFilterChange(filter);
    onOpenChange(false);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search people"
      description="Find a contact by name or filter the board by profile."
    >
      <CommandInput placeholder="Search people…" />
      <CommandList>
        <CommandEmpty>
          <span className="t-body-sm italic text-ink-3">
            No one by that name in the book.
          </span>
        </CommandEmpty>
        <CommandGroup heading="People">
          {people.map((person) => {
            const stage = getStageById(stages, person.stage);
            const tone = getToneStyle(stage.tone);

            return (
              <CommandItem
                key={person.id}
                className="gap-2.5"
                value={`${person.name} ${person.id.slice(0, 6)}`}
                onSelect={() => choosePerson(person.id)}
              >
                <PersonFramedAvatar person={person} size="xs" />
                <span className="t-body-sm min-w-0 flex-1 truncate">
                  {person.name}
                </span>
                <span aria-hidden className={`size-1.5 rounded-full ${tone.core}`} />
                <span className="t-meta-sm text-ink-4">
                  {displayStageCopy(stage.shortLabel)}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Show on board">
          <CommandItem className="gap-2.5" value="filter all contacts" onSelect={() => chooseFilter("all")}>
            <Filter className="size-3.5 text-ink-3" />
            <span className="t-body-sm flex-1">All contacts</span>
            {profileFilter === "all" ? <Check className="size-3.5 text-brand" /> : null}
          </CommandItem>
          {activeProfile ? (
            <CommandItem className="gap-2.5" value="filter my contacts" onSelect={() => chooseFilter("mine")}>
              <Filter className="size-3.5 text-ink-3" />
              <span className="t-body-sm flex-1">My contacts</span>
              {profileFilter === "mine" ? <Check className="size-3.5 text-brand" /> : null}
            </CommandItem>
          ) : null}
          {profiles.map((profile) => (
            <CommandItem
              key={profile.id}
              className="gap-2.5"
              value={`filter ${profile.name}`}
              onSelect={() => chooseFilter(profile.id)}
            >
              <FramedAvatar
                name={profile.name}
                avatarUrl={profile.avatar_url}
                offsetX={profile.avatar_offset_x}
                offsetY={profile.avatar_offset_y}
                scale={profile.avatar_scale}
                size="xs"
              />
              <span className="t-body-sm flex-1 truncate">{profile.name}’s contacts</span>
              {profileFilter === profile.id ? <Check className="size-3.5 text-brand" /> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
