"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  Columns3,
  Layers3,
  MoonStar,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UsersRound,
} from "lucide-react";

import type { BoardPerson, BoardProfile } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardView } from "@/lib/board-view-client";
import { nextTheme, useTheme, type Theme } from "@/lib/theme-client";
import type { Stage } from "@/lib/stages";
import { cn } from "@/lib/utils";

import { ProfileFramedAvatar } from "../primitives/framed-avatar";
import { SearchCommand } from "./search-command";

const THEME_COPY: Record<Theme, { label: string; icon: typeof Sun }> = {
  light: { label: "Daybreak", icon: Sun },
  dark: { label: "Vespers", icon: MoonStar },
  star: { label: "Night Watch", icon: Sparkles },
};

type MastheadProps = {
  people: BoardPerson[];
  stages: Stage[];
  profiles: BoardProfile[];
  activeProfile: BoardProfile | null;
  configured: boolean;
  notificationCount: number;
  boardView: BoardView;
  profileFilter: string;
  onProfileFilterChange: (filter: string) => void;
  onBoardViewChange: (view: BoardView) => void;
  onSelectProfile: (profileId: string) => void;
  onOpenProfiles: () => void;
  onSelectContact: (personId: string) => void;
  onAddContact: () => void;
  onOpenGraphs: () => void;
  onOpenStages: () => void;
  onOpenNotifications: () => void;
};

/**
 * The masthead: a thin editorial band. Gold-leaf wordmark and mono date on
 * the left like a newspaper folio line; search, attention bell, profile,
 * and the single accent action on the right.
 */
export function Masthead({
  people,
  stages,
  profiles,
  activeProfile,
  configured,
  notificationCount,
  boardView,
  profileFilter,
  onProfileFilterChange,
  onBoardViewChange,
  onSelectProfile,
  onOpenProfiles,
  onSelectContact,
  onAddContact,
  onOpenGraphs,
  onOpenStages,
  onOpenNotifications,
}: MastheadProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const themeCopy = THEME_COPY[theme] ?? THEME_COPY.light;
  const ThemeIcon = themeCopy.icon;
  const nextThemeCopy = THEME_COPY[nextTheme(theme)] ?? THEME_COPY.light;

  const today = new Date();
  const dateLine = `${today.toLocaleDateString("en", {
    weekday: "long",
  })} · ${today.toLocaleDateString("en", { month: "short", day: "numeric" })}`;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const badgeCount = Math.min(notificationCount, 9);

  return (
    <header className="sticky top-0 z-(--z-appbar) border-b bg-canvas/85 backdrop-blur-md [border-bottom-color:color-mix(in_oklch,var(--sd-accent)_18%,var(--sd-line))]">
      <div className="relative mx-auto flex h-14 w-full max-w-[1840px] items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="wordmark leading-none max-sm:absolute max-sm:left-1/2 max-sm:-translate-x-1/2">
            <span className="logo-seal">
              <span>S</span>
            </span>
            <span className="logo-word text-gilt">Drive</span>
          </span>
          <span aria-hidden className="hidden h-4 w-px self-center bg-line-strong md:block" />
          <span className="t-meta hidden whitespace-nowrap text-ink-3 md:inline">
            {dateLine}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Search — full field on desktop, icon on mobile */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              "hidden h-9 items-center gap-2 rounded-(--sd-r-md) border border-line bg-surface px-3 shadow-(--sd-shadow-well)",
              "text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:flex"
            )}
          >
            <Search className="size-3.5" />
            <span className="t-label">Search people</span>
            <kbd className="t-meta-sm ml-3 rounded-(--sd-r-xs) border border-line px-1 py-0.5 text-ink-4">
              ⌘K
            </kbd>
          </button>
          <Button
            aria-label="Search people"
            className="text-ink-2 sm:hidden"
            onClick={() => setSearchOpen(true)}
            size="icon-sm"
            variant="ghost"
          >
            <Search className="size-4" />
          </Button>

          {/* Attention bell */}
          <Button
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ""}`}
            className="relative text-ink-2"
            onClick={onOpenNotifications}
            size="icon-sm"
            variant="ghost"
          >
            <Bell className="size-4" />
            {badgeCount > 0 ? (
              <span
                aria-hidden
                className="t-meta-sm absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-signal-urgent leading-none text-white"
              >
                {badgeCount}
              </span>
            ) : null}
          </Button>

          {/* Profile switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-(--sd-r-md) px-1.5 transition-colors hover:bg-surface-sunken"
              >
                <ProfileFramedAvatar profile={activeProfile} size="sm" />
                <span className="t-label hidden max-w-28 truncate text-ink-2 lg:block">
                  {activeProfile?.name ?? "Choose profile"}
                </span>
                <ChevronDown className="hidden size-3 text-ink-4 lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="t-meta-sm text-ink-3">
                Working as
              </DropdownMenuLabel>
              {profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  className="gap-2.5"
                  onSelect={() => onSelectProfile(profile.id)}
                >
                  <ProfileFramedAvatar profile={profile} size="xs" />
                  <span className="t-body-sm min-w-0 flex-1 truncate">
                    {profile.name}
                  </span>
                  <span className="t-meta-sm text-ink-4">
                    {profile.active_contacts}
                  </span>
                  {profile.id === activeProfile?.id ? (
                    <Check className="size-3.5 text-brand" />
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" onSelect={onOpenProfiles}>
                <UsersRound className="size-4 text-ink-3" />
                <span className="t-body-sm">Manage profiles…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Overflow: view, theme, stages, almanac */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Board settings"
                className="hidden text-ink-2 sm:inline-flex"
                size="icon-sm"
                variant="ghost"
              >
                <SlidersHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="gap-2.5"
                onSelect={() =>
                  onBoardViewChange(boardView === "pipeline" ? "stack" : "pipeline")
                }
              >
                {boardView === "pipeline" ? (
                  <Layers3 className="size-4 text-ink-3" />
                ) : (
                  <Columns3 className="size-4 text-ink-3" />
                )}
                <span className="t-body-sm">
                  {boardView === "pipeline" ? "Stack view" : "Pipeline view"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5"
                onSelect={() => setTheme(nextTheme(theme))}
              >
                <ThemeIcon className="size-4 text-ink-3" />
                <span className="t-body-sm">Theme: {themeCopy.label}</span>
                <span className="t-meta-sm ml-auto text-ink-4">
                  → {nextThemeCopy.label}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" onSelect={onOpenGraphs}>
                <BarChart3 className="size-4 text-ink-3" />
                <span className="t-body-sm">Data</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5" onSelect={onOpenStages}>
                <SlidersHorizontal className="size-4 text-ink-3" />
                <span className="t-body-sm">Edit stages…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* The single accent action — phones use the bottom bar's FAB */}
          <Button
            className="btn-illuminated ml-1 hidden h-9 gap-1.5 rounded-(--sd-r-md) px-3.5 sm:inline-flex"
            disabled={!configured}
            onClick={onAddContact}
          >
            <Plus className="size-4" />
            <span className="t-label">Add person</span>
          </Button>
        </div>
      </div>

      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        people={people}
        stages={stages}
        profiles={profiles}
        activeProfile={activeProfile}
        profileFilter={profileFilter}
        onProfileFilterChange={onProfileFilterChange}
        onSelectContact={onSelectContact}
      />
    </header>
  );
}
