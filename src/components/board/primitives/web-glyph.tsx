import type { CSSProperties } from "react";

/**
 * A corner of spider silk: three spokes anchored at the corner, three
 * threads sagging between them. Strokes in currentColor so callers set
 * the voice (stage tone, button ink) with color alone.
 */
export function WebGlyph({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      style={style}
    >
      <path d="M1 1 22.2 4.7 M1 1 16.2 16.2 M1 1 4.7 22.2" />
      <path d="M9.9 2.6 Q7.6 4.4 7.4 7.4 Q4.4 7.6 2.6 9.9" />
      <path d="M16.3 3.7 Q12.3 6.9 12 12 Q6.9 12.3 3.7 16.3" />
      <path d="M22.2 4.7 Q16.6 9.1 16.2 16.2 Q9.1 16.6 4.7 22.2" />
    </svg>
  );
}
