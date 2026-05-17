"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  createProfile,
  deleteProfile,
  updateProfileAvatar,
  type BoardProfile,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { setActiveProfileId } from "@/lib/profiles-client";
import { cn } from "@/lib/utils";

type ProfileSheetProps = {
  open: boolean;
  required?: boolean;
  profiles: BoardProfile[];
  activeProfileId: string;
  onClose: () => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  onSelectProfile: (profileId: string) => void;
};

export function ProfileSheet({
  open,
  required,
  profiles,
  activeProfileId,
  onClose,
  onProfilesChange,
  onSelectProfile,
}: ProfileSheetProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busyProfileId, setBusyProfileId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [isPending, startTransition] = useTransition();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTargetRef = useRef("");

  function selectProfile(profileId: string) {
    setActiveProfileId(profileId);
    onSelectProfile(profileId);
    if (!required) {
      onClose();
    }
  }

  function handleCreate(formData: FormData) {
    const profileName = String(formData.get("profileName") ?? "");
    setError("");

    startTransition(async () => {
      const result = await createProfile(profileName);

      if (!result.ok || !result.data) {
        setError(result.ok ? "Could not create profile." : result.error);
        return;
      }

      const nextProfiles = [...profiles, result.data].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      onProfilesChange(nextProfiles);
      setName("");
      selectProfile(result.data.id);
    });
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const profileId = avatarTargetRef.current;

    if (!file || !profileId) {
      return;
    }

    setError("");
    setBusyProfileId(profileId);

    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      const result = await updateProfileAvatar(profileId, avatarUrl);

      if (!result.ok || !result.data) {
        setError(result.ok ? "Could not update photo." : result.error);
        return;
      }

      onProfilesChange(
        profiles.map((profile) =>
          profile.id === result.data?.id ? { ...profile, ...result.data } : profile
        )
      );
    } catch (avatarError) {
      setError(
        avatarError instanceof Error ? avatarError.message : "Could not update photo."
      );
    } finally {
      setBusyProfileId("");
    }
  }

  function requestAvatar(profileId: string) {
    avatarTargetRef.current = profileId;
    avatarInputRef.current?.click();
  }

  function handleDelete(profileId: string) {
    setError("");
    setBusyProfileId(profileId);

    startTransition(async () => {
      const result = await deleteProfile(profileId);

      if (!result.ok) {
        setError(result.error);
        setBusyProfileId("");
        return;
      }

      onProfilesChange(profiles.filter((profile) => profile.id !== profileId));
      setConfirmDeleteId("");
      setBusyProfileId("");
    });
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
          <motion.button
            aria-label="Close profiles"
            className="absolute inset-0 bg-foreground/55 backdrop-blur-md"
            disabled={required}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={required ? undefined : onClose}
            type="button"
          />
          <motion.div
            className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border bg-card p-5 shadow-[0_60px_120px_-30px_oklch(0.2_0.028_264_/_0.45)] sm:rounded-[1.75rem]"
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Choose profile"
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-foreground/10 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Profiles
                </p>
                <h2 className="mt-1.5 font-display text-3xl leading-[0.95] tracking-display sm:text-4xl">
                  Who is using the board?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Pick your profile once. Contacts, moves, and notes are attached
                  to it until you switch.
                </p>
              </div>
              {!required ? (
                <Button onClick={onClose} size="icon" type="button" variant="ghost">
                  <X className="size-5" />
                </Button>
              ) : null}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleAvatarChange}
            />

            <div className="mt-5 space-y-2">
              {profiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-foreground/15 bg-background/60 p-6 text-center text-sm italic text-muted-foreground">
                  No profiles yet. Add the first one below.
                </div>
              ) : null}
              {profiles.map((profile) => {
                const active = profile.id === activeProfileId;
                const confirming = profile.id === confirmDeleteId;
                const busy = profile.id === busyProfileId;

                return (
                  <div
                    key={profile.id}
                    className={cn(
                      "rounded-2xl border border-foreground/10 bg-background/70 p-3 transition",
                      active && "border-foreground/30 bg-foreground/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        aria-label={`Change ${profile.name}'s photo`}
                        className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/15 bg-card font-display tracking-display text-foreground/80 shadow-[0_1px_0_oklch(1_0_0_/_0.6)_inset]"
                        disabled={busy}
                        onClick={() => requestAvatar(profile.id)}
                        type="button"
                      >
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="size-full object-cover"
                            draggable={false}
                            src={profile.avatar_url}
                          />
                        ) : (
                          profile.name.slice(0, 1).toUpperCase()
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card bg-foreground p-1 text-background">
                          <Camera className="size-2.5" />
                        </span>
                      </button>

                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => selectProfile(profile.id)}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate font-display text-lg leading-[1.05] tracking-display text-foreground">
                            {profile.name}
                          </span>
                          {active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-background">
                              <Check className="size-3" />
                              Active
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">
                          {profile.active_contacts} contacts · {profile.baptized_this_month} baptized this month
                        </span>
                      </button>

                      <Button
                        disabled={busy}
                        onClick={() =>
                          confirming
                            ? handleDelete(profile.id)
                            : setConfirmDeleteId(profile.id)
                        }
                        size="icon-sm"
                        type="button"
                        variant={confirming ? "destructive" : "ghost"}
                      >
                        {confirming ? (
                          <Check className="size-4" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                    {confirming ? (
                      <p className="mt-2 text-[0.72rem] text-muted-foreground">
                        Tap the check to delete. Profiles with active contacts can&apos;t be removed.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <form action={handleCreate} className="mt-5 flex gap-2 rounded-2xl border border-foreground/10 bg-background/70 p-1.5">
              <input
                name="profileName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Add profile name"
                className="min-w-0 flex-1 rounded-xl bg-transparent px-3 text-sm tracking-tight outline-none placeholder:text-muted-foreground/70"
              />
              <Button disabled={isPending} type="submit" size="sm">
                {isPending ? (
                  <RefreshCcw className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add
              </Button>
            </form>

            {error ? (
              <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function fileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Choose an image file."));
  }

  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("Photo must be under 5 MB."));
  }

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const outputSize = 192;
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
      const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Could not prepare photo."));
        return;
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read photo."));
    };

    image.src = objectUrl;
  });
}
