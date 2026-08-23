"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ArrowRight, Loader2, MapPin, Plus } from "lucide-react";

import { createRegion, type BoardRegion } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { setActiveRegionId } from "@/lib/region-client";
import { cn } from "@/lib/utils";

type RegionGateProps = {
  regions: BoardRegion[];
};

/**
 * First screen of onboarding: choose the region you're serving in (or found a
 * new one). The choice lands in the sd-region cookie, and a full reload brings
 * the board back scoped to that region — where the required profile picker
 * ("who are you") takes over as step two.
 */
export function RegionGate({ regions }: RegionGateProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = isPending || enteringId !== null;
  const hasRegions = regions.length > 0;

  function enterRegion(id: string) {
    setEnteringId(id);
    setActiveRegionId(id);
    // A reload (not router.refresh) so the board state re-initializes from
    // freshly scoped server data.
    window.location.reload();
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || !name.trim()) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createRegion(name);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.data) {
        enterRegion(result.data.id);
      }
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

        <p className="t-meta mt-8 text-ink-4">First, your region</p>
        <h1 className="t-display-lg mt-2 text-center">
          Where are you serving?
        </h1>
        <p className="t-body-sm mt-3 max-w-sm text-center text-ink-3">
          {hasRegions
            ? "Each region keeps its own board — its people, its teachers, its studies. Pick yours to open it."
            : "Each region keeps its own board — its people, its teachers, its studies. Name yours to open the first one."}
        </p>

        {hasRegions ? (
          <div className="mt-8 flex w-full flex-col gap-2">
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                disabled={busy}
                onClick={() => enterRegion(region.id)}
                className={cn(
                  "card-lit group flex h-12 w-full items-center gap-3 rounded-(--sd-r-md) border border-line bg-surface px-4 text-left",
                  "transition-colors hover:border-line-strong disabled:opacity-60"
                )}
              >
                <MapPin className="size-4 shrink-0 text-gilt" />
                <span className="t-body min-w-0 flex-1 truncate">
                  {region.name}
                </span>
                {enteringId === region.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-ink-4" />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            ))}
          </div>
        ) : null}

        {hasRegions ? (
          <div className="mt-6 flex w-full items-center gap-3">
            <span aria-hidden className="h-px flex-1 bg-line" />
            <span className="t-meta-sm text-ink-4">or start a new one</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        <form onSubmit={handleCreate} className="mt-6 flex w-full gap-2">
          <Input
            value={name}
            disabled={busy}
            maxLength={40}
            placeholder="Name your region…"
            aria-label="Region name"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            className="h-11 flex-1"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className={cn(
              "btn-illuminated flex h-11 shrink-0 items-center gap-2 rounded-(--sd-r-md) px-4",
              "t-label transition-opacity disabled:opacity-50"
            )}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Open board
          </button>
        </form>

        {error ? (
          <p role="alert" className="t-body-sm mt-3 w-full text-signal-urgent">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
