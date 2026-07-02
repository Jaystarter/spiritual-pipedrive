"use client";

import { TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ShellBannersProps = {
  configured: boolean;
  notice?: string;
  onDismissNotice: () => void;
};

/** Thin hairline banners under the masthead for config + transient errors. */
export function ShellBanners({ configured, notice, onDismissNotice }: ShellBannersProps) {
  if (configured && !notice) {
    return null;
  }

  return (
    <div className="border-b border-line">
      {!configured ? (
        <div className="mx-auto flex w-full max-w-[1840px] items-center gap-2.5 px-4 py-2 text-signal-wane sm:px-6">
          <TriangleAlert className="size-4 shrink-0" />
          <p className="t-body-sm">
            Add <code className="t-meta">SUPABASE_URL</code> and{" "}
            <code className="t-meta">SUPABASE_SECRET_KEY</code> to connect the board.
          </p>
        </div>
      ) : null}
      {notice ? (
        <div className="mx-auto flex w-full max-w-[1840px] items-center gap-2.5 px-4 py-2 text-signal-urgent sm:px-6">
          <TriangleAlert className="size-4 shrink-0" />
          <p className="t-body-sm min-w-0 flex-1">{notice}</p>
          <Button
            aria-label="Dismiss"
            className="size-6 text-signal-urgent hover:text-signal-urgent"
            onClick={onDismissNotice}
            size="icon-xs"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
