import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A printed-broadsheet statistic: mono eyebrow label over a large serif
 * numeral. The registrar states the fact; the name gives it weight.
 */
export function LedgerStat({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "urgent" | "joy" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="t-meta-sm truncate text-ink-3">{label}</span>
      <span
        className={cn(
          "t-display-lg tabular-nums leading-none",
          tone === "default" && "text-ink",
          tone === "muted" && "text-ink-3",
          tone === "urgent" && "text-signal-urgent",
          tone === "joy" && "text-tone-green-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}
