"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import {
  Camera,
  Check,
  Crop,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  createProfile,
  deleteProfile,
  renameProfile,
  updateProfileAvatar,
  updateProfileAvatarFraming,
  updateProfileGender,
  type BoardProfile,
  type PersonGender,
} from "@/app/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AvatarFramingAdjuster,
  DEFAULT_AVATAR_FRAMING,
  type AvatarFraming,
} from "@/components/profiles/avatar-framing-adjuster";
import { fileToAvatarDataUrl } from "@/components/board/lib/avatar";
import { ProfileFramedAvatar } from "@/components/board/primitives/framed-avatar";
import { cn } from "@/lib/utils";

type ProfileSheetProps = {
  open: boolean;
  required?: boolean;
  profiles: BoardProfile[];
  activeProfileId: string;
  /** Region whose board is on screen — stamped onto newly created profiles. */
  regionId: string | null;
  /**
   * On the hub board every location's workers mix, so rows name each
   * worker's region. Null everywhere else.
   */
  regionNameById: Record<string, string> | null;
  onClose: () => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  onSelectProfile: (profileId: string) => void;
};

/**
 * The workers' register: every teacher profile as a ledger row — choose who
 * you are, add someone new, tend portraits, rename, or retire a profile.
 */
export function ProfileSheet({
  open,
  required,
  profiles,
  activeProfileId,
  regionId,
  regionNameById,
  onClose,
  onProfilesChange,
  onSelectProfile,
}: ProfileSheetProps) {
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<PersonGender | null>(null);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [adjusterProfileId, setAdjusterProfileId] = useState("");
  const [adjusterError, setAdjusterError] = useState("");
  const [isSavingFraming, setIsSavingFraming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BoardProfile | null>(null);
  const [isPending, startTransition] = useTransition();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTargetRef = useRef("");
  const openAdjusterAfterUploadRef = useRef(false);

  const adjusterProfile =
    profiles.find((profile) => profile.id === adjusterProfileId) ?? null;

  function replaceProfile(next: BoardProfile) {
    onProfilesChange(
      profiles.map((profile) => (profile.id === next.id ? next : profile))
    );
  }

  function addProfile() {
    const name = newName.trim();

    if (!name) {
      setError("Give the profile a name.");
      return;
    }

    if (!newGender) {
      setError("Choose brother or sister — it sets their default view.");
      return;
    }

    startTransition(async () => {
      // New teachers belong to the region whose board is on screen — passed
      // down from the board root rather than re-read from the cookie, so a
      // region switch in another tab can't stamp the wrong region.
      const result = await createProfile(name, regionId ?? undefined, newGender);

      if (!result.ok || !result.data) {
        setError(result.ok ? "The profile could not be created." : result.error);
        return;
      }

      setError("");
      setNewName("");
      setNewGender(null);
      onProfilesChange([...profiles, result.data]);
    });
  }

  function commitGender(profile: BoardProfile, gender: PersonGender) {
    startTransition(async () => {
      const result = await updateProfileGender(profile.id, gender);

      if (!result.ok || !result.data) {
        setError(result.ok ? "Could not update the profile." : result.error);
        return;
      }

      setError("");
      // Merge just the gender so the row keeps its computed contact stats.
      replaceProfile({ ...profile, gender: result.data.gender });
    });
  }

  function commitRename(profile: BoardProfile) {
    const name = renameDraft.trim();

    if (!name || name === profile.name) {
      setRenamingId("");
      return;
    }

    startTransition(async () => {
      const result = await renameProfile(profile.id, name);

      if (!result.ok || !result.data) {
        setError(result.ok ? "The profile could not be renamed." : result.error);
        return;
      }

      setError("");
      replaceProfile(result.data);
      setRenamingId("");
    });
  }

  function requestPhoto(profileId: string, thenAdjust: boolean) {
    avatarTargetRef.current = profileId;
    openAdjusterAfterUploadRef.current = thenAdjust;
    avatarInputRef.current?.click();
  }

  async function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const profileId = avatarTargetRef.current;

    if (!file || !profileId) {
      return;
    }

    try {
      const avatarUrl = await fileToAvatarDataUrl(file);

      startTransition(async () => {
        const result = await updateProfileAvatar(profileId, avatarUrl);

        if (!result.ok || !result.data) {
          setError(result.ok ? "Could not update the photo." : result.error);
          return;
        }

        setError("");
        replaceProfile(result.data);

        if (openAdjusterAfterUploadRef.current) {
          setAdjusterProfileId(profileId);
          setAdjusterError("");
        }
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Could not read the photo."
      );
    }
  }

  function removePhoto(profileId: string) {
    startTransition(async () => {
      const result = await updateProfileAvatar(profileId, null);

      if (!result.ok || !result.data) {
        setAdjusterError(result.ok ? "Could not remove the photo." : result.error);
        return;
      }

      setAdjusterError("");
      replaceProfile(result.data);
      setAdjusterProfileId("");
    });
  }

  function saveFraming(framing: AvatarFraming) {
    const profileId = adjusterProfileId;

    if (!profileId) {
      return;
    }

    setIsSavingFraming(true);
    startTransition(async () => {
      const result = await updateProfileAvatarFraming(profileId, framing);

      setIsSavingFraming(false);

      if (!result.ok || !result.data) {
        setAdjusterError(result.ok ? "Could not save the framing." : result.error);
        return;
      }

      setAdjusterError("");
      replaceProfile(result.data);
      setAdjusterProfileId("");
    });
  }

  function confirmDelete() {
    const target = deleteTarget;

    if (!target) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProfile(target.id);

      if (!result.ok) {
        setError(result.error);
        setDeleteTarget(null);
        return;
      }

      setError("");
      setDeleteTarget(null);
      onProfilesChange(profiles.filter((profile) => profile.id !== target.id));
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // In required mode the sheet cannot be dismissed until a profile
        // is chosen — choosing one closes it via onSelectProfile.
        if (!next && !required) {
          onClose();
        }
      }}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 border-line bg-surface-raised p-0 sm:max-w-[440px]"
        side="right"
      >
        <div className="gilt-wash-head border-b border-line px-5 pb-4 pt-5">
          <SheetTitle className="t-display-md text-ink">The workers</SheetTitle>
          <SheetDescription className="t-body-sm mt-1 text-ink-3">
            {required
              ? "Choose who you are to open the ledger."
              : "Choose who you are, or tend the register."}
          </SheetDescription>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {error ? (
            <p className="t-body-sm mx-2 mb-2 rounded-(--sd-r-sm) border border-line bg-surface-sunken px-3 py-2 text-signal-urgent">
              {error}
            </p>
          ) : null}

          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;

            return (
              <div
                key={profile.id}
                className={cn(
                  "group flex items-center gap-3 rounded-(--sd-r-md) px-2 py-2 transition-colors",
                  isActive ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
                )}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => onSelectProfile(profile.id)}
                  type="button"
                >
                  <ProfileFramedAvatar profile={profile} size="md" />
                  <span className="min-w-0 flex-1">
                    {renamingId === profile.id ? (
                      <Input
                        autoFocus
                        className="t-display-sm h-8 border-line bg-surface px-2"
                        onBlur={() => commitRename(profile)}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitRename(profile);
                          }

                          if (event.key === "Escape") {
                            setRenamingId("");
                          }
                        }}
                        value={renameDraft}
                      />
                    ) : (
                      <span className="t-display-sm block truncate text-ink">
                        {profile.name}
                      </span>
                    )}
                    <span className="t-meta-sm mt-0.5 block text-ink-4">
                      {profile.active_contacts} contact
                      {profile.active_contacts === 1 ? "" : "s"}
                      {regionNameById?.[profile.region_id ?? ""]
                        ? ` · ${regionNameById[profile.region_id ?? ""]}`
                        : ""}
                      {profile.baptized_this_month > 0
                        ? ` · ${profile.baptized_this_month} baptized this month`
                        : ""}
                    </span>
                  </span>
                  {isActive ? <Check className="size-4 shrink-0 text-brand" /> : null}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Options for ${profile.name}`}
                      className="size-7 shrink-0 text-ink-4 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      size="icon-xs"
                      variant="ghost"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => {
                        setRenamingId(profile.id);
                        setRenameDraft(profile.name);
                      }}
                    >
                      <Pencil className="size-3.5 text-ink-3" />
                      <span className="t-body-sm">Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => requestPhoto(profile.id, true)}
                    >
                      <Camera className="size-3.5 text-ink-3" />
                      <span className="t-body-sm">
                        {profile.avatar_url ? "Replace photo" : "Add photo"}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(
                      [
                        { id: "male", label: "Brother" },
                        { id: "female", label: "Sister" },
                      ] as const
                    ).map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        className="gap-2"
                        onSelect={() => commitGender(profile, option.id)}
                      >
                        <span className="flex size-3.5 items-center justify-center">
                          {profile.gender === option.id ? (
                            <Check className="size-3.5 text-brand" />
                          ) : null}
                        </span>
                        <span className="t-body-sm">{option.label}</span>
                      </DropdownMenuItem>
                    ))}
                    {profile.avatar_url ? (
                      <>
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => {
                            setAdjusterProfileId(profile.id);
                            setAdjusterError("");
                          }}
                        >
                          <Crop className="size-3.5 text-ink-3" />
                          <span className="t-body-sm">Adjust framing</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => removePhoto(profile.id)}
                        >
                          <ImageOff className="size-3.5 text-ink-3" />
                          <span className="t-body-sm">Remove photo</span>
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-signal-urgent focus:text-signal-urgent"
                      onSelect={() => setDeleteTarget(profile)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="t-body-sm">Delete profile</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-line px-5 py-4">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addProfile();
            }}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label="New profile name"
                className="t-body-sm h-9 border-line bg-surface"
                maxLength={30}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Add a worker…"
                value={newName}
              />
              <Button
                className="btn-illuminated t-label h-9 gap-1.5 px-3"
                disabled={isPending || !newName.trim() || !newGender}
                type="submit"
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            <div
              className="flex gap-2"
              role="group"
              aria-label="Brother or sister?"
            >
              {(
                [
                  { id: "male", label: "Brother" },
                  { id: "female", label: "Sister" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={isPending}
                  aria-pressed={newGender === option.id}
                  onClick={() => {
                    setNewGender(option.id);
                    setError("");
                  }}
                  className={cn(
                    "t-label h-8 flex-1 rounded-(--sd-r-sm) border transition-colors",
                    newGender === option.id
                      ? "border-brand bg-surface text-brand"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </form>
        </footer>

        <input
          ref={avatarInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
          type="file"
        />

        {adjusterProfile ? (
          <AvatarFramingAdjuster
            name={adjusterProfile.name}
            avatarUrl={adjusterProfile.avatar_url}
            framing={{
              offsetX: adjusterProfile.avatar_offset_x ?? DEFAULT_AVATAR_FRAMING.offsetX,
              offsetY: adjusterProfile.avatar_offset_y ?? DEFAULT_AVATAR_FRAMING.offsetY,
              scale: adjusterProfile.avatar_scale ?? DEFAULT_AVATAR_FRAMING.scale,
            }}
            saving={isSavingFraming}
            error={adjusterError}
            onSave={saveFraming}
            onCancel={() => setAdjusterProfileId("")}
            onReplacePhoto={() => requestPhoto(adjusterProfile.id, true)}
            onRemovePhoto={() => removePhoto(adjusterProfile.id)}
          />
        ) : null}

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(next) => !next && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="t-display-md">
                Delete {deleteTarget?.name}?
              </AlertDialogTitle>
              <AlertDialogDescription className="t-body-sm">
                {deleteTarget && deleteTarget.active_contacts > 0
                  ? `${deleteTarget.name} still has ${deleteTarget.active_contacts} active contact${deleteTarget.active_contacts === 1 ? "" : "s"} — reassign them first.`
                  : "Their profile leaves the register. Contacts they created keep their history."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="t-label">Keep them</AlertDialogCancel>
              <Button
                className="t-label bg-signal-urgent text-white hover:bg-signal-urgent/90"
                disabled={isPending || (deleteTarget?.active_contacts ?? 0) > 0}
                onClick={confirmDelete}
              >
                Delete profile
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
