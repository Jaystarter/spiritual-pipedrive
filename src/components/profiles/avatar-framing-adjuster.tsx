"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, RefreshCcw, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type AvatarFraming = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

const DEFAULT_FRAMING: AvatarFraming = {
  offsetX: 50,
  offsetY: 50,
  scale: 1,
};

const FRAME_DIAMETER = 240;

type AvatarFramingAdjusterProps = {
  open: boolean;
  avatarUrl: string | null;
  framing: AvatarFraming;
  busy?: boolean;
  saving?: boolean;
  error?: string;
  title?: string;
  onCancel: () => void;
  onSave: (framing: AvatarFraming) => void;
  onReplacePhoto?: () => void;
  onRemovePhoto?: () => void;
};

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function AvatarFramingAdjuster(props: AvatarFramingAdjusterProps) {
  return (
    <AnimatePresence>
      {props.open ? <AvatarFramingAdjusterPanel {...props} /> : null}
    </AnimatePresence>
  );
}

function AvatarFramingAdjusterPanel({
  avatarUrl,
  framing,
  busy = false,
  saving = false,
  error,
  title = "Adjust photo",
  onCancel,
  onSave,
  onReplacePhoto,
  onRemovePhoto,
}: AvatarFramingAdjusterProps) {
  const headingId = useId();
  const [draft, setDraft] = useState<AvatarFraming>(() => ({
    offsetX: clamp(framing.offsetX, 0, 100),
    offsetY: clamp(framing.offsetY, 0, 100),
    scale: 1,
  }));
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingPointerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !busy) {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, busy, onCancel]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!avatarUrl || saving || busy) {
        return;
      }

      const frame = frameRef.current;

      if (!frame) {
        return;
      }

      event.preventDefault();
      frame.setPointerCapture(event.pointerId);
      draggingPointerRef.current = event.pointerId;
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: draft.offsetX,
        offsetY: draft.offsetY,
      };
    },
    [avatarUrl, busy, draft.offsetX, draft.offsetY, saving]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        draggingPointerRef.current !== event.pointerId ||
        !dragStartRef.current
      ) {
        return;
      }

      const frame = frameRef.current;

      if (!frame) {
        return;
      }

      const rect = frame.getBoundingClientRect();
      const denom = Math.max(rect.width, 1);
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      // Dragging the visible image to the right (positive deltaX) means the
      // user wants to see more of the image's LEFT portion, which corresponds
      // to a SMALLER object-position X percentage.
      const nextX = clamp(
        dragStartRef.current.offsetX - (deltaX / denom) * 100,
        0,
        100
      );
      const nextY = clamp(
        dragStartRef.current.offsetY - (deltaY / denom) * 100,
        0,
        100
      );

      setDraft((current) => ({
        ...current,
        offsetX: roundTo(nextX, 2),
        offsetY: roundTo(nextY, 2),
      }));
    },
    []
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (draggingPointerRef.current !== event.pointerId) {
        return;
      }

      const frame = frameRef.current;

      if (frame && frame.hasPointerCapture(event.pointerId)) {
        frame.releasePointerCapture(event.pointerId);
      }

      draggingPointerRef.current = null;
      dragStartRef.current = null;
    },
    []
  );

  function handleSave() {
    onSave({
      offsetX: roundTo(clamp(draft.offsetX, 0, 100), 2),
      offsetY: roundTo(clamp(draft.offsetY, 0, 100), 2),
      scale: 1,
    });
  }

  const disabled = !avatarUrl;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center px-3 py-6">
      <motion.button
        aria-label="Close adjuster"
        className="absolute inset-0"
        style={{ background: "rgba(236, 239, 243, 0.85)" }}
        disabled={saving}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={saving ? undefined : onCancel}
        type="button"
      />
      <div aria-hidden className="circuit-bg" />
      <motion.div
        className="neu-raised relative z-10 w-full max-w-sm overflow-hidden p-5"
        style={{ borderRadius: "1.75rem", background: "var(--neu-bg)" }}
        initial={{ opacity: 0, y: 60, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              id={headingId}
              className="font-display text-xl leading-tight tracking-display text-[var(--neu-text-strong)]"
            >
              {title}
            </p>
            <p className="mt-1 text-[0.72rem] font-medium text-[var(--neu-text-muted)]">
              Drag to reposition.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            disabled={saving}
            className="neu-raised-sm inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          <div
            className="neu-inset overflow-hidden"
            style={{
              width: FRAME_DIAMETER,
              height: FRAME_DIAMETER,
              borderRadius: "9999px",
              padding: 0,
            }}
          >
            <div
              ref={frameRef}
              aria-label="Drag to reposition photo"
              role="presentation"
              className="relative size-full select-none overflow-hidden"
              style={{
                borderRadius: "9999px",
                cursor: disabled ? "default" : "grab",
                touchAction: "none",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  draggable={false}
                  src={avatarUrl}
                  className="pointer-events-none size-full select-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: `${draft.offsetX}% ${draft.offsetY}%`,
                  }}
                />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-[var(--neu-text-muted)]">
                  Upload a photo to adjust framing.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
          {onRemovePhoto && avatarUrl ? (
            <button
              type="button"
              onClick={onRemovePhoto}
              disabled={saving || busy}
              aria-label="Remove photo"
              title="Remove photo (show initial)"
              className="neu-raised-sm inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[0.78rem] font-semibold text-[var(--neu-text)] transition hover:text-[var(--neu-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-danger)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderRadius: "999px" }}
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          ) : null}
          {onReplacePhoto ? (
            <button
              type="button"
              onClick={onReplacePhoto}
              disabled={saving || busy}
              className="neu-raised-sm inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[0.78rem] font-semibold text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderRadius: "999px" }}
            >
              <Camera className="size-3.5" />
              Replace
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="neu-raised-sm inline-flex items-center justify-center px-4 py-2 text-[0.78rem] font-semibold text-[var(--neu-text)] transition hover:text-[var(--neu-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "999px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || disabled}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-[0.78rem] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderRadius: "999px",
              background:
                "linear-gradient(135deg, var(--neu-accent), var(--neu-accent-soft))",
              boxShadow:
                "-3px -3px 8px var(--neu-shadow-light), 3px 3px 10px var(--neu-shadow-dark)",
            }}
          >
            {saving ? (
              <RefreshCcw className="size-3.5 animate-spin" />
            ) : null}
            Save
          </button>
        </div>

        {error ? (
          <p
            className="neu-inset mt-3 px-3 py-2 text-sm"
            style={{ borderRadius: "0.875rem", color: "var(--neu-danger)" }}
          >
            {error}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

export { DEFAULT_FRAMING };
