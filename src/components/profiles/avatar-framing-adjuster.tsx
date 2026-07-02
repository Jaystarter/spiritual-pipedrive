"use client";

import { useCallback, useRef, useState } from "react";
import { ImageOff, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export type AvatarFraming = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

export const DEFAULT_AVATAR_FRAMING: AvatarFraming = {
  offsetX: 50,
  offsetY: 50,
  scale: 1,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

type AvatarFramingAdjusterProps = {
  name: string;
  avatarUrl: string | null;
  framing: AvatarFraming;
  saving?: boolean;
  error?: string;
  onSave: (framing: AvatarFraming) => void;
  onCancel: () => void;
  onReplacePhoto: () => void;
  onRemovePhoto: () => void;
};

/**
 * Frame the portrait: drag to pan, slide to zoom (avatar_scale — stored and
 * rendered for years, finally editable).
 */
export function AvatarFramingAdjuster({
  name,
  avatarUrl,
  framing,
  saving = false,
  error,
  onSave,
  onCancel,
  onReplacePhoto,
  onRemovePhoto,
}: AvatarFramingAdjusterProps) {
  const [draft, setDraft] = useState<AvatarFraming>({
    offsetX: clamp(framing.offsetX, 0, 100),
    offsetY: clamp(framing.offsetY, 0, 100),
    scale: clamp(framing.scale || 1, 1, 3),
  });
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingPointerRef = useRef<number | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!avatarUrl || saving) {
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
    [avatarUrl, draft.offsetX, draft.offsetY, saving]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (draggingPointerRef.current !== event.pointerId || !dragStartRef.current) {
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

      // Dragging the image right reveals more of its LEFT portion — a
      // smaller object-position X percentage.
      setDraft((current) => ({
        ...current,
        offsetX: roundTo(
          clamp(dragStartRef.current!.offsetX - (deltaX / denom) * 100, 0, 100),
          2
        ),
        offsetY: roundTo(
          clamp(dragStartRef.current!.offsetY - (deltaY / denom) * 100, 0, 100),
          2
        ),
      }));
    },
    []
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPointerRef.current !== event.pointerId) {
      return;
    }

    draggingPointerRef.current = null;
    dragStartRef.current = null;
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="max-w-sm gap-4 border-line bg-surface-raised">
        <DialogHeader>
          <DialogTitle className="t-display-md text-ink">
            Frame {name}’s portrait
          </DialogTitle>
          <DialogDescription className="t-body-sm text-ink-3">
            Drag to reposition · slide to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            ref={frameRef}
            className="relative size-56 cursor-grab touch-none overflow-hidden rounded-full ring-1 ring-line active:cursor-grabbing"
            onPointerCancel={endDrag}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="size-full select-none object-cover"
                draggable={false}
                src={avatarUrl}
                style={{
                  objectPosition: `${draft.offsetX}% ${draft.offsetY}%`,
                  transform: `scale(${draft.scale})`,
                  transformOrigin: "center",
                }}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-surface-sunken text-ink-4">
                <ImageOff className="size-6" />
              </div>
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <span className="t-meta-sm w-10 text-ink-4">Zoom</span>
            <Slider
              aria-label="Zoom"
              disabled={!avatarUrl || saving}
              max={3}
              min={1}
              onValueChange={([value]) =>
                setDraft((current) => ({ ...current, scale: roundTo(value, 2) }))
              }
              step={0.05}
              value={[draft.scale]}
            />
            <span className="t-meta-sm w-10 text-right tabular-nums text-ink-4">
              {draft.scale.toFixed(2)}×
            </span>
          </div>

          {error ? <p className="t-body-sm text-signal-urgent">{error}</p> : null}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              className="t-label gap-1.5 text-ink-2"
              disabled={saving}
              onClick={onReplacePhoto}
              size="sm"
              variant="ghost"
            >
              <RefreshCcw className="size-3.5" />
              Replace
            </Button>
            <Button
              className="t-label gap-1.5 text-signal-urgent hover:text-signal-urgent"
              disabled={saving || !avatarUrl}
              onClick={onRemovePhoto}
              size="sm"
              variant="ghost"
            >
              <ImageOff className="size-3.5" />
              Remove
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              className="t-label"
              disabled={saving}
              onClick={onCancel}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="btn-illuminated t-label"
              disabled={saving || !avatarUrl}
              onClick={() => onSave(draft)}
              size="sm"
            >
              {saving ? "Saving…" : "Save framing"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
