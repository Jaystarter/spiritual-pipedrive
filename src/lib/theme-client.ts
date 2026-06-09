"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "star";

const THEME_KEY = "sd-theme";
const DEFAULT_THEME: Theme = "light";
const THEME_CHANGE_EVENT = "sd-theme-change";

// Order the toggle cycles through: light → dark → star → light.
const THEME_CYCLE: Theme[] = ["light", "dark", "star"];

const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "star";
}

function applyTheme(theme: Theme) {
  if (!isBrowser()) {
    return;
  }

  const root = document.documentElement;

  // "light" is the default (no attribute); "dark" and "star" set data-theme.
  if (theme === "light") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

export function nextTheme(theme: Theme): Theme {
  const index = THEME_CYCLE.indexOf(theme);

  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length] ?? DEFAULT_THEME;
}

export function getTheme(): Theme {
  if (!isBrowser()) {
    return DEFAULT_THEME;
  }

  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function getThemeServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function setTheme(theme: Theme) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode, quota); proceed anyway.
  }

  applyTheme(theme);

  listeners.forEach((listener) => listener());

  try {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
  } catch {
    // CustomEvent unavailable in some test environments; safe to ignore.
  }
}

export function onThemeChange(listener: () => void) {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
      listener();
    }
  };

  if (isBrowser()) {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(listener);

    if (isBrowser()) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = useSyncExternalStore(
    onThemeChange,
    getTheme,
    getThemeServerSnapshot
  );

  const update = useCallback((next: Theme) => {
    setTheme(next);
  }, []);

  return [theme, update];
}
