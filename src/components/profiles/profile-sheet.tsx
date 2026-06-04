"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Check, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  createProfile,
  deleteProfile,
  renameProfile,
  updateProfileAvatar,
  updateProfileAvatarFraming,
  type BoardProfile,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  AvatarFramingAdjuster,
  type AvatarFraming,
} from "@/components/profiles/avatar-framing-adjuster";
import { setActiveProfileId } from "@/lib/profiles-client";

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
  const [editingProfileId, setEditingProfileId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [adjusterProfileId, setAdjusterProfileId] = useState("");
  const [adjusterError, setAdjusterError] = useState("");
  const [isSavingFraming, setIsSavingFraming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRenaming, startRenameTransition] = useTransition();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTargetRef = useRef("");
  const openAdjusterAfterUploadRef = useRef(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingProfileId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingProfileId]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  function selectProfile(profileId: string) {
    setActiveProfileId(profileId);
    onSelectProfile(profileId);
    if (!required) {
      onClose();
    }
  }

  function clearClickTimer() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }

  function handleNameClick(profileId: string) {
    clearClickTimer();
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      selectProfile(profileId);
    }, 220);
  }

  function handleNameDoubleClick(profile: BoardProfile) {
    clearClickTimer();

    if (busyProfileId === profile.id) {
      return;
    }

    setRenameError("");
    setError("");
    setConfirmDeleteId("");
    setEditingProfileId(profile.id);
    setEditingName(profile.name);
  }

  function cancelRename() {
    clearClickTimer();
    setEditingProfileId("");
    setEditingName("");
    setRenameError("");
  }

  function commitRename(profileId: string) {
    if (isRenaming) {
      return;
    }

    const trimmed = editingName.trim();
    const original = profiles.find((profile) => profile.id === profileId)?.name ?? "";

    if (!trimmed || trimmed === original) {
      cancelRename();
      return;
    }

    setRenameError("");
    setError("");

    startRenameTransition(async () => {
      const result = await renameProfile(profileId, trimmed);

      if (!result.ok || !result.data) {
        setRenameError(result.ok ? "Could not rename profile." : result.error);
        return;
      }

      const updated = result.data;
      const nextProfiles = profiles
        .map((profile) =>
          profile.id === updated.id ? { ...profile, ...updated } : profile
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      onProfilesChange(nextProfiles);
      setEditingProfileId("");
      setEditingName("");
    });
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
    const shouldOpenAdjuster = openAdjusterAfterUploadRef.current;
    openAdjusterAfterUploadRef.current = false;

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

      if (shouldOpenAdjuster) {
        setAdjusterError("");
        setAdjusterProfileId(profileId);
      }
    } catch (avatarError) {
      setError(
        avatarError instanceof Error ? avatarError.message : "Could not update photo."
      );
    } finally {
      setBusyProfileId("");
    }
  }

  function openFilePicker(profileId: string, openAdjusterAfter: boolean) {
    avatarTargetRef.current = profileId;
    openAdjusterAfterUploadRef.current = openAdjusterAfter;
    avatarInputRef.current?.click();
  }

  function requestAvatar(profile: BoardProfile) {
    setError("");

    if (profile.avatar_url) {
      setAdjusterError("");
      setAdjusterProfileId(profile.id);
      return;
    }

    openFilePicker(profile.id, true);
  }

  function handleReplacePhoto() {
    if (!adjusterProfileId) {
      return;
    }

    openFilePicker(adjusterProfileId, false);
  }

  async function handleRemovePhoto() {
    const profileId = adjusterProfileId;

    if (!profileId || isSavingFraming) {
      return;
    }

    setAdjusterError("");
    setIsSavingFraming(true);

    onProfilesChange(
      profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              avatar_url: null,
              avatar_offset_x: 50,
              avatar_offset_y: 50,
              avatar_scale: 1,
            }
          : profile
      )
    );

    try {
      const result = await updateProfileAvatar(profileId, null);

      if (!result.ok || !result.data) {
        setAdjusterError(result.ok ? "Could not remove photo." : result.error);
        return;
      }

      onProfilesChange(
        profiles.map((profile) =>
          profile.id === result.data?.id ? { ...profile, ...result.data } : profile
        )
      );
      setAdjusterProfileId("");
    } catch (removeError) {
      setAdjusterError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove photo."
      );
    } finally {
      setIsSavingFraming(false);
    }
  }

  function closeAdjuster() {
    if (isSavingFraming) {
      return;
    }

    setAdjusterProfileId("");
    setAdjusterError("");
  }

  async function handleSaveFraming(framing: AvatarFraming) {
    const profileId = adjusterProfileId;

    if (!profileId) {
      return;
    }

    setAdjusterError("");
    setIsSavingFraming(true);

    onProfilesChange(
      profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              avatar_offset_x: framing.offsetX,
              avatar_offset_y: framing.offsetY,
              avatar_scale: framing.scale,
            }
          : profile
      )
    );

    try {
      const result = await updateProfileAvatarFraming(profileId, framing);

      if (!result.ok || !result.data) {
        setAdjusterError(result.ok ? "Could not save framing." : result.error);
        return;
      }

      onProfilesChange(
        profiles.map((profile) =>
          profile.id === result.data?.id ? { ...profile, ...result.data } : profile
        )
      );
      setAdjusterProfileId("");
    } catch (framingError) {
      setAdjusterError(
        framingError instanceof Error
          ? framingError.message
          : "Could not save framing."
      );
    } finally {
      setIsSavingFraming(false);
    }
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

  const adjusterProfile = profiles.find(
    (profile) => profile.id === adjusterProfileId
  );

  return (
    <>
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center px-3 py-6">
          <motion.button
            aria-label="Close profiles"
            className="absolute inset-0"
            style={{ background: "rgba(236, 239, 243, 0.85)" }}
            disabled={required}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={required ? undefined : onClose}
            type="button"
          />
          <div aria-hidden className="circuit-bg" />
          <motion.div
            className="neu-raised relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto p-5"
            style={{ borderRadius: "1.75rem", background: "var(--neu-bg)" }}
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Choose profile"
          >
            <div
              className="mx-auto mb-3 h-1 w-12 rounded-full sm:hidden"
              style={{ background: "rgba(163, 177, 198, 0.4)" }}
            />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[var(--neu-text-strong)]">
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

            <div
              className="mt-4 divide-y"
              style={{
                borderTop: "1px solid rgba(163, 177, 198, 0.35)",
                borderBottom: "1px solid rgba(163, 177, 198, 0.35)",
                borderColor: "rgba(163, 177, 198, 0.35)",
              }}
            >
              {profiles.length === 0 ? (
                <div className="p-6 text-center text-sm italic text-[var(--neu-text-muted)]">
                  No profiles yet. Add the first one below.
                </div>
              ) : null}
              {profiles.map((profile) => {
                const active = profile.id === activeProfileId;
                const confirming = profile.id === confirmDeleteId;
                const busy = profile.id === busyProfileId;
                const editing = profile.id === editingProfileId;
                const savingThisRow = editing && isRenaming;

                return (
                  <div
                    key={profile.id}
                    className="relative py-3 transition"
                    style={{
                      borderColor: "rgba(163, 177, 198, 0.35)",
                    }}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="neu-accent-fill absolute bottom-3 left-0 top-3 w-1 rounded-full"
                      />
                    ) : null}
                    <div className="flex items-center gap-3 pl-3">
                      <button
                        aria-label={
                          profile.avatar_url
                            ? `Adjust ${profile.name}'s photo`
                            : `Add ${profile.name}'s photo`
                        }
                        className="neu-raised-sm relative flex size-12 shrink-0 items-center justify-center overflow-hidden font-display tracking-display text-[var(--neu-text)]"
                        style={{ borderRadius: "999px" }}
                        disabled={busy || savingThisRow}
                        onClick={() => requestAvatar(profile)}
                        type="button"
                      >
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="size-full"
                            draggable={false}
                            src={profile.avatar_url}
                            style={{
                              objectFit: "cover",
                              objectPosition: `${profile.avatar_offset_x ?? 50}% ${profile.avatar_offset_y ?? 50}%`,
                              transform: `scale(${profile.avatar_scale ?? 1})`,
                              transformOrigin: "center",
                            }}
                          />
                        ) : (
                          profile.name.slice(0, 1).toUpperCase()
                        )}
                        <span
                          className="neu-pressed absolute -bottom-0.5 -right-0.5 inline-flex size-5 items-center justify-center rounded-full text-[var(--neu-accent)]"
                        >
                          <Camera className="size-2.5" />
                        </span>
                      </button>

                      {editing ? (
                        <div className="min-w-0 flex-1">
                          <div className="neu-inset flex items-center gap-2 px-3 py-1.5" style={{ borderRadius: "999px" }}>
                            <input
                              ref={editInputRef}
                              aria-label={`Rename ${profile.name}`}
                              className="min-w-0 flex-1 bg-transparent py-0.5 font-display text-lg leading-[1.05] tracking-display text-[var(--neu-text-strong)] outline-none transition-colors disabled:opacity-60"
                              disabled={savingThisRow}
                              maxLength={30}
                              onBlur={() => commitRename(profile.id)}
                              onChange={(event) => setEditingName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitRename(profile.id);
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRename();
                                }
                              }}
                              type="text"
                              value={editingName}
                            />
                            {savingThisRow ? (
                              <RefreshCcw className="size-3.5 shrink-0 animate-spin text-[var(--neu-text-muted)]" />
                            ) : null}
                          </div>
                          <span className="mt-1 block pl-3 text-[0.72rem] font-medium text-[var(--neu-text-muted)]">
                            {profile.active_contacts} contacts · {profile.baptized_this_month} baptized this month
                          </span>
                        </div>
                      ) : (
                        <button
                          aria-label={`Switch to ${profile.name}. Double-tap to rename.`}
                          className="min-w-0 flex-1 cursor-text text-left"
                          disabled={busy}
                          onClick={() => handleNameClick(profile.id)}
                          onDoubleClick={() => handleNameDoubleClick(profile)}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <span className="truncate font-display text-lg leading-[1.05] tracking-display text-[var(--neu-text-strong)]">
                              {profile.name}
                            </span>
                            {active ? (
                              <span className="inline-flex items-center gap-1 text-[0.6rem] font-black uppercase tracking-[0.16em] text-[var(--neu-accent)]">
                                <Check className="size-3" />
                                Active
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[0.72rem] font-medium text-[var(--neu-text-muted)]">
                            {profile.active_contacts} contacts · {profile.baptized_this_month} baptized this month
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        aria-label={confirming ? `Confirm delete ${profile.name}` : `Delete ${profile.name}`}
                        disabled={busy || savingThisRow}
                        onClick={() =>
                          confirming
                            ? handleDelete(profile.id)
                            : setConfirmDeleteId(profile.id)
                        }
                        className="neu-raised-sm inline-flex size-9 shrink-0 items-center justify-center rounded-full transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        style={confirming ? { color: "var(--neu-danger)" } : { color: "var(--neu-text)" }}
                      >
                        {confirming ? (
                          <Check className="size-4" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </div>
                    {confirming ? (
                      <p className="mt-2 pl-3 text-[0.72rem] text-[var(--neu-text-muted)]">
                        Tap the check to delete. Profiles with active contacts can&apos;t be removed.
                      </p>
                    ) : null}
                    {editing && renameError ? (
                      <p className="mt-2 pl-3 text-[0.72rem]" style={{ color: "var(--neu-danger)" }}>
                        {renameError}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <form action={handleCreate} className="mt-5 flex items-center gap-2">
              <div
                className="neu-inset flex min-w-0 flex-1 items-center px-4 py-2"
                style={{ borderRadius: "999px" }}
              >
                <input
                  name="profileName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Add profile name"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold tracking-tight text-[var(--neu-text-strong)] outline-none placeholder:text-[var(--neu-text-muted)]"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="neu-raised-sm inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--neu-accent)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderRadius: "999px" }}
              >
                {isPending ? (
                  <RefreshCcw className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add
              </button>
            </form>

            {error ? (
              <p
                className="neu-inset mt-3 px-3 py-2 text-sm"
                style={{ borderRadius: "0.875rem", color: "var(--neu-danger)" }}
              >
                {error}
              </p>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
    <AvatarFramingAdjuster
      open={Boolean(adjusterProfile)}
      avatarUrl={adjusterProfile?.avatar_url ?? null}
      framing={{
        offsetX: adjusterProfile?.avatar_offset_x ?? 50,
        offsetY: adjusterProfile?.avatar_offset_y ?? 50,
        scale: adjusterProfile?.avatar_scale ?? 1,
      }}
      busy={Boolean(adjusterProfile && busyProfileId === adjusterProfile.id)}
      saving={isSavingFraming}
      error={adjusterError}
      title={adjusterProfile ? `Adjust ${adjusterProfile.name}'s photo` : "Adjust photo"}
      onCancel={closeAdjuster}
      onSave={handleSaveFraming}
      onReplacePhoto={handleReplacePhoto}
      onRemovePhoto={handleRemovePhoto}
    />
    </>
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
      // Preserve the aspect ratio so the user can re-frame the photo with
      // the avatar adjuster. We just resize the long edge to MAX_DIMENSION.
      const MAX_DIMENSION = 384;
      const { naturalWidth, naturalHeight } = image;

      if (naturalWidth === 0 || naturalHeight === 0) {
        reject(new Error("Could not read photo."));
        return;
      }

      const longest = Math.max(naturalWidth, naturalHeight);
      const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
      const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
      const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Could not prepare photo."));
        return;
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read photo."));
    };

    image.src = objectUrl;
  });
}
