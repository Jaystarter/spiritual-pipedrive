"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * A single line that glides right-to-left and back when its text is wider
 * than the box, so the whole phrase can be read in place. Static (and
 * simply clipped) when it fits; still when the reader prefers reduced
 * motion (the .marquee-scroll utility handles that).
 */
export function MarqueeText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    const line = lineRef.current;

    if (!frame || !line) {
      return;
    }

    const measure = () =>
      setDistance(Math.max(0, line.scrollWidth - frame.clientWidth));

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(line);

    return () => observer.disconnect();
  }, [children]);

  return (
    <span
      ref={frameRef}
      className={cn("block min-w-0 overflow-hidden whitespace-nowrap", className)}
    >
      <span
        ref={lineRef}
        className={cn("inline-block", distance > 0 && "marquee-scroll")}
        style={
          distance > 0
            ? ({
                "--marquee-distance": `${distance}px`,
                // A reading pace: ~25px per second, never rushed.
                "--marquee-duration": `${Math.max(4, Math.round(distance / 25))}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
