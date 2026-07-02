"use client";

import type { BoardPerson, BoardProfile } from "@/app/actions";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "size-6 text-[0.7rem]",
  sm: "size-8 text-[0.85rem]",
  md: "size-10 text-base",
  lg: "size-14 text-xl",
  xl: "size-20 text-3xl",
} as const;

export type FramedAvatarSize = keyof typeof SIZE_CLASSES;

type FramedAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  offsetX?: number | null;
  offsetY?: number | null;
  scale?: number | null;
  size?: FramedAvatarSize;
  className?: string;
  title?: string;
};

/**
 * The ledger's portrait: a hairline-ringed circle showing the stored photo
 * with its saved framing (pan + zoom), or the name's first letter set in
 * serif — like an initial capital in a register.
 */
export function FramedAvatar({
  name,
  avatarUrl,
  offsetX,
  offsetY,
  scale,
  size = "md",
  className,
  title,
}: FramedAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "·";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-surface-sunken ring-1 ring-line",
        SIZE_CLASSES[size],
        className
      )}
      title={title ?? name}
    >
      {avatarUrl ? (
        // Data-URL avatars; next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          draggable={false}
          src={avatarUrl}
          style={{
            objectPosition: `${offsetX ?? 50}% ${offsetY ?? 50}%`,
            transform: `scale(${scale ?? 1})`,
            transformOrigin: "center",
          }}
        />
      ) : (
        <span aria-hidden className="t-display-sm select-none italic leading-none text-ink-3">
          {initial}
        </span>
      )}
    </span>
  );
}

export function ProfileFramedAvatar({
  profile,
  size = "md",
  className,
  title,
}: {
  profile: BoardProfile | null;
  size?: FramedAvatarSize;
  className?: string;
  title?: string;
}) {
  return (
    <FramedAvatar
      name={profile?.name ?? "No profile"}
      avatarUrl={profile?.avatar_url}
      offsetX={profile?.avatar_offset_x}
      offsetY={profile?.avatar_offset_y}
      scale={profile?.avatar_scale}
      size={size}
      className={className}
      title={title}
    />
  );
}

export function PersonFramedAvatar({
  person,
  size = "md",
  className,
}: {
  person: BoardPerson;
  size?: FramedAvatarSize;
  className?: string;
}) {
  return (
    <FramedAvatar
      name={person.name}
      avatarUrl={person.avatar_url}
      size={size}
      className={className}
    />
  );
}
