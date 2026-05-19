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
        <div className="fixed inset-0 z-[130] flex items-center justify-center px-3 py-6">
          <motion.button
            aria-label="Close profiles"
            className="absolute inset-0 bg-sky-950/24 backdrop-blur-xl"
            disabled={required}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={required ? undefined : onClose}
            type="button"
          />
          <motion.div
            className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-white/60 bg-white/62 p-5 shadow-[0_60px_120px_-30px_oklch(0.2_0.028_264_/_0.45),0_1px_0_oklch(1_0_0_/_0.88)_inset] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Choose profile"
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-foreground/10 sm:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-slate-950">
                  Profiles
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

            <div className="mt-4 divide-y divide-slate-950/10 border-y border-white/60">
              {profiles.length === 0 ? (
                <div className="p-6 text-center text-sm italic text-slate-950/70">
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
                      "relative py-3 transition",
                      active && "bg-sky-50/30"
                    )}
                  >
                    {active ? (
                      <span className="absolute bottom-3 left-0 top-3 w-1 rounded-full bg-sky-400" />
                    ) : null}
                    <div className="flex items-center gap-3 pl-3">
                      <button
                        aria-label={`Change ${profile.name}'s photo`}
                        className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/70 font-display tracking-display text-foreground/80 shadow-[0_1px_0_oklch(1_0_0_/_0.8)_inset,0_10px_24px_-18px_oklch(0.25_0.04_250_/_0.5)]"
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
                          <span className="truncate font-display text-lg leading-[1.05] tracking-display text-slate-950">
                            {profile.name}
                          </span>
                          {active ? (
                            <span className="inline-flex items-center gap-1 text-[0.6rem] font-black uppercase tracking-[0.16em] text-sky-700">
                              <Check className="size-3" />
                              Active
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[0.72rem] font-medium text-slate-950/70">
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
                      <p className="mt-2 pl-3 text-[0.72rem] text-slate-950/70">
                        Tap the check to delete. Profiles with active contacts can&apos;t be removed.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <form action={handleCreate} className="mt-5 flex items-center gap-2 border-b border-slate-950/15 pb-2">
              <input
                name="profileName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Add profile name"
                className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-950/45"
              />
              <Button disabled={isPending} type="submit" size="sm" className="rounded-full">
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
