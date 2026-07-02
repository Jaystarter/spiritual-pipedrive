"use client";

import { UserRoundPlus, UsersRound } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { useBoardActions, useBoardData } from "../board-context";
import { AvatarStack } from "../primitives/avatar-stack";
import { ProfileFramedAvatar } from "../primitives/framed-avatar";

const MAX_ASSIGNEES = 3;

/**
 * Who walks with this person: up to three profiles as checkbox items.
 * Profile management lives in the profile sheet with explicit controls.
 */
export function AssignmentPicker({
  assignedProfileIds,
  onChange,
}: {
  assignedProfileIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { profiles } = useBoardData();
  const actions = useBoardActions();
  const assignedProfiles = assignedProfileIds
    .map((id) => profiles.find((profile) => profile.id === id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  const atCapacity = assignedProfileIds.length >= MAX_ASSIGNEES;

  function toggleProfile(profileId: string, checked: boolean) {
    if (checked) {
      if (assignedProfileIds.includes(profileId) || atCapacity) {
        return;
      }

      onChange([...assignedProfileIds, profileId]);
      return;
    }

    onChange(assignedProfileIds.filter((id) => id !== profileId));
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <AvatarStack profiles={assignedProfiles} max={3} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="t-label gap-1.5 text-ink-2" size="sm" variant="outline">
            <UserRoundPlus className="size-3.5" />
            {assignedProfiles.length > 0 ? "Change" : "Assign"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="t-meta-sm text-ink-3">
            Walking with them ({assignedProfileIds.length}/{MAX_ASSIGNEES})
          </DropdownMenuLabel>
          {profiles.map((profile) => {
            const checked = assignedProfileIds.includes(profile.id);

            return (
              <DropdownMenuCheckboxItem
                key={profile.id}
                checked={checked}
                className="gap-2.5"
                disabled={!checked && atCapacity}
                onCheckedChange={(nextChecked) => toggleProfile(profile.id, nextChecked)}
                onSelect={(event) => event.preventDefault()}
              >
                <ProfileFramedAvatar profile={profile} size="xs" />
                <span className="t-body-sm min-w-0 flex-1 truncate">{profile.name}</span>
              </DropdownMenuCheckboxItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2.5" onSelect={actions.openProfiles}>
            <UsersRound className="size-4 text-ink-3" />
            <span className="t-body-sm">Manage profiles…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
