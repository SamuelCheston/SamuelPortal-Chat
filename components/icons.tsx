import type { SVGProps } from "react";

export function PortalMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="26" height="26" rx="9" fill="currentColor" />
      <path d="M10 20V12h4.5a4 4 0 0 1 0 8H10m7-8h5m-5 4h5" stroke="var(--mark-ink, #fffdf8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
