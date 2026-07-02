import type { BoardProfile } from "@/app/actions";
import { cn } from "@/lib/utils";

import { ProfileFramedAvatar } from "./framed-avatar";

/** Overlapping hairline-ringed portraits with a +n tally past the cap. */
export function AvatarStack({
  profiles,
  max = 2,
  className,
}: {
  profiles: BoardProfile[];
  max?: number;
  className?: string;
}) {
  if (profiles.length === 0) {
    return null;
  }

  const shown = profiles.slice(0, max);
  const overflow = profiles.length - shown.length;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="flex -space-x-2">
        {shown.map((profile) => (
          <ProfileFramedAvatar
            key={profile.id}
            profile={profile}
            size="xs"
            className="ring-2 ring-surface"
          />
        ))}
      </span>
      {overflow > 0 ? (
        <span className="t-meta-sm ml-1 text-ink-4">+{overflow}</span>
      ) : null}
    </span>
  );
}
