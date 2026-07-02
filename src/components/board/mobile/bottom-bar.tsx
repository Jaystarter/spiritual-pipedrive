"use client";

import { useState } from "react";
import {
  BarChart3,
  Bell,
  Columns3,
  Layers3,
  MoonStar,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UsersRound,
} from "lucide-react";

import type { BoardProfile } from "@/app/actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BoardView } from "@/lib/board-view-client";
import { nextTheme, useTheme, type Theme } from "@/lib/theme-client";
import { cn } from "@/lib/utils";

import { ProfileFramedAvatar } from "../primitives/framed-avatar";

const THEME_COPY: Record<Theme, { label: string; icon: typeof Sun }> = {
  light: { label: "Daybreak", icon: Sun },
  dark: { label: "Vespers", icon: MoonStar },
  star: { label: "Night Watch", icon: Sparkles },
};

type BottomBarProps = {
  activeProfile: BoardProfile | null;
  attentionCount: number;
  boardView: BoardView;
  onBoardViewChange: (view: BoardView) => void;
  onAddContact: () => void;
  onOpenAttention: () => void;
  onOpenGraphs: () => void;
  onOpenStages: () => void;
  onOpenProfiles: () => void;
};

/**
 * The phone's thumb row: Attention · Almanac · [+] · View · More. Replaces
 * the floating action rail; safe-area padded so it clears home indicators.
 */
export function BottomBar({
  activeProfile,
  attentionCount,
  boardView,
  onBoardViewChange,
  onAddContact,
  onOpenAttention,
  onOpenGraphs,
  onOpenStages,
  onOpenProfiles,
}: BottomBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const themeCopy = THEME_COPY[theme] ?? THEME_COPY.light;
  const ThemeIcon = themeCopy.icon;
  const nextCopy = THEME_COPY[nextTheme(theme)] ?? THEME_COPY.light;
  const badge = Math.min(attentionCount, 9);

  const itemClass =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-ink-3 transition-colors active:text-ink";

  return (
    <>
      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-(--z-appbar) border-t border-line bg-surface-raised/95 backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch">
          <button className={itemClass} onClick={onOpenAttention} type="button">
            <span className="relative">
              <Bell className="size-5" />
              {badge > 0 ? (
                <span className="t-meta-sm absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-signal-urgent leading-none text-white">
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="t-meta-sm">Attention</span>
          </button>
          <button className={itemClass} onClick={onOpenGraphs} type="button">
            <BarChart3 className="size-5" />
            <span className="t-meta-sm">Almanac</span>
          </button>
          <button
            aria-label="Add person"
            className="flex flex-1 items-start justify-center"
            onClick={onAddContact}
            type="button"
          >
            <span className="btn-illuminated -mt-4 flex size-12 items-center justify-center rounded-full">
              <Plus className="size-5" />
            </span>
          </button>
          <button
            className={itemClass}
            onClick={() =>
              onBoardViewChange(boardView === "pipeline" ? "stack" : "pipeline")
            }
            type="button"
          >
            {boardView === "pipeline" ? (
              <Layers3 className="size-5" />
            ) : (
              <Columns3 className="size-5" />
            )}
            <span className="t-meta-sm">View</span>
          </button>
          <button className={itemClass} onClick={() => setMoreOpen(true)} type="button">
            <SlidersHorizontal className="size-5" />
            <span className="t-meta-sm">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          className="gap-0 rounded-t-(--sd-r-xl) border-line bg-surface-raised p-0"
          side="bottom"
        >
          <SheetTitle className="sr-only">More</SheetTitle>
          <SheetDescription className="sr-only">
            Profile, theme, and board settings.
          </SheetDescription>
          <div
            className="flex flex-col py-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
          >
            <button
              className="flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-surface-sunken"
              onClick={() => {
                setMoreOpen(false);
                onOpenProfiles();
              }}
              type="button"
            >
              <ProfileFramedAvatar profile={activeProfile} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="t-body-sm block truncate text-ink">
                  {activeProfile?.name ?? "Choose profile"}
                </span>
                <span className="t-meta-sm text-ink-4">Switch or manage profiles</span>
              </span>
              <UsersRound className="size-4 text-ink-4" />
            </button>
            <button
              className={cn(
                "flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-surface-sunken"
              )}
              onClick={() => setTheme(nextTheme(theme))}
              type="button"
            >
              <ThemeIcon className="size-4 text-ink-3" />
              <span className="t-body-sm flex-1 text-ink">
                Theme: {themeCopy.label}
              </span>
              <span className="t-meta-sm text-ink-4">→ {nextCopy.label}</span>
            </button>
            <button
              className="flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-surface-sunken"
              onClick={() => {
                setMoreOpen(false);
                onOpenStages();
              }}
              type="button"
            >
              <SlidersHorizontal className="size-4 text-ink-3" />
              <span className="t-body-sm text-ink">Edit stages…</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
