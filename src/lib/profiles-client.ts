"use client";

const ACTIVE_PROFILE_KEY = "bible-study.active-profile-id";

const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

export function getActiveProfileId() {
  if (!isBrowser()) {
    return "";
  }

  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

export function getActiveProfileServerSnapshot() {
  return "";
}

export function setActiveProfileId(id: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  listeners.forEach((listener) => listener());
}

export function clearActiveProfileId() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
  listeners.forEach((listener) => listener());
}

export function onActiveProfileChange(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
