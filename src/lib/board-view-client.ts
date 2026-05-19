"use client";

export type BoardView = "pipeline" | "stack";

const BOARD_VIEW_KEY = "bible-study.board-view";
const DEFAULT_BOARD_VIEW: BoardView = "pipeline";

const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

function isBoardView(value: string | null): value is BoardView {
  return value === "pipeline" || value === "stack";
}

export function getBoardView() {
  if (!isBrowser()) {
    return DEFAULT_BOARD_VIEW;
  }

  const storedView = window.localStorage.getItem(BOARD_VIEW_KEY);

  return isBoardView(storedView) ? storedView : DEFAULT_BOARD_VIEW;
}

export function getBoardViewServerSnapshot() {
  return DEFAULT_BOARD_VIEW;
}

export function setBoardView(view: BoardView) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(BOARD_VIEW_KEY, view);
  listeners.forEach((listener) => listener());
}

export function onBoardViewChange(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
