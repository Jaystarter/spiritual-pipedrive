import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Mono eyebrow + hairline rule — the ledger's section divider. */
export function SectionHeading({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="t-meta-sm shrink-0 text-ink-3">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {action}
    </div>
  );
}
