"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "sd-theme";
const DEFAULT_THEME: Theme = "light";
const THEME_CHANGE_EVENT = "sd-theme-change";

const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function applyTheme(theme: Theme) {
  if (!isBrowser()) {
    return;
  }

  const root = document.documentElement;

  if (theme === "dark") {
    root.dataset.theme = "dark";
  } else {
    delete root.dataset.theme;
  }
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
