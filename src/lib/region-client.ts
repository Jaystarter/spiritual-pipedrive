"use client";

import { REGION_COOKIE_NAME } from "@/lib/region-cookie";

// The active region lives in a cookie (not localStorage) so the server can
// scope listPeople() to it on first render. Same subscription contract as
// profiles-client / theme-client / board-view-client.
const REGION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

function isBrowser() {
  return typeof document !== "undefined";
}

export function getActiveRegionId() {
  if (!isBrowser()) {
    return "";
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${REGION_COOKIE_NAME}=([^;]+)`)
  );

  return match ? decodeURIComponent(match[1]) : "";
}

export function getActiveRegionServerSnapshot() {
  return "";
}

export function setActiveRegionId(id: string) {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${REGION_COOKIE_NAME}=${encodeURIComponent(
    id
  )}; path=/; max-age=${REGION_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  listeners.forEach((listener) => listener());
}

export function clearActiveRegionId() {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${REGION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  listeners.forEach((listener) => listener());
}

export function onActiveRegionChange(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
