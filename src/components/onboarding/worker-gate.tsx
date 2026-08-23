"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";

import { createProfile, type BoardProfile } from "@/app/actions";
import { ProfileFramedAvatar } from "@/components/board/primitives/framed-avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WorkerGateProps = {
  regionName: string;
  regionId: string | null;
  profiles: BoardProfile[];
  /** On the hub, workers from other locations carry their region's name. */
  regionNameById: Record<string, string> | null;
  onSelect: (profileId: string) => void;
  onProfilesChange: (profiles: BoardProfile[]) => void;
  /** Back to the region gate — for anyone who picked the wrong location. */
  onBack: () => void;
};

/**
 * Onboarding step two, centered like the region gate that precedes it: pick
 * yourself from the region's workers or add your name. Replaces the old
 * forced side sheet, which read as a blocked screen rather than a welcome —
 * the ProfileSheet now only opens when someone chooses "Manage profiles".
 */
export function WorkerGate({
  regionName,
  regionId,
  profiles,
  regionNameById,
  onSelect,
  onProfilesChange,
  onBack,
}: WorkerGateProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasWorkers = profiles.length > 0;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending || !name.trim()) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createProfile(name, regionId ?? undefined);

      if (!result.ok || !result.data) {
        setError(
          result.ok ? "Your name could not be added." : result.error
        );
        return;
      }

      onProfilesChange([...profiles, result.data]);
      onSelect(result.data.id);
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-16">
        <span className="wordmark">
          <span className="logo-seal">
            <span>Z</span>
          </span>
          <span className="logo-word text-gilt">Zion Drive</span>
        </span>

        <p className="t-meta mt-8 text-ink-4">Next, your name</p>
        <h1 className="t-display-lg mt-2 text-center">Who are you?</h1>
        <p className="t-body-sm mt-3 max-w-sm text-center text-ink-3">
          {hasWorkers
            ? `Your name goes on everything you write in ${regionName}'s book. Pick yourself, or add your name below.`
            : `Be the first: add your name to open ${regionName}'s board.`}
        </p>

        {hasWorkers ? (
          <div className="mt-8 flex max-h-72 w-full flex-col gap-2 overflow-y-auto">
            {profiles.map((profile) => {
              const originLabel =
                regionNameById?.[profile.region_id ?? ""] ?? null;

              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => onSelect(profile.id)}
                  className={cn(
                    "card-lit group flex h-14 w-full shrink-0 items-center gap-3 rounded-(--sd-r-md) border border-line bg-surface px-3.5 text-left",
                    "transition-colors hover:border-line-strong disabled:opacity-60"
                  )}
                >
                  <ProfileFramedAvatar profile={profile} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="t-display-sm block truncate">
                      {profile.name}
                    </span>
                    <span className="t-meta-sm block text-ink-4">
                      {profile.active_contacts} contact
                      {profile.active_contacts === 1 ? "" : "s"}
                      {originLabel ? ` · ${originLabel}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>
        ) : null}

        {hasWorkers ? (
          <div className="mt-6 flex w-full items-center gap-3">
            <span aria-hidden className="h-px flex-1 bg-line" />
            <span className="t-meta-sm text-ink-4">or add your name</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        <form onSubmit={handleCreate} className="mt-6 flex w-full gap-2">
          <Input
            value={name}
            disabled={isPending}
            maxLength={30}
            placeholder="Your name…"
            aria-label="Your name"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            className="h-11 flex-1"
          />
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className={cn(
              "btn-illuminated t-label flex h-11 shrink-0 items-center gap-2 rounded-(--sd-r-md) px-4",
              "transition-opacity disabled:opacity-50"
            )}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Open the ledger
          </button>
        </form>

        {error ? (
          <p role="alert" className="t-body-sm mt-3 w-full text-signal-urgent">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          className="t-label mt-8 flex items-center gap-1.5 text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Not {regionName}? Choose a different region
        </button>
      </div>
    </main>
  );
}
