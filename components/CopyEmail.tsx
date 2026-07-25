"use client";

import { useEffect, useRef, useState } from "react";

interface CopyEmailProps {
  /** The address to put on the clipboard — the same one the mailto beside it uses. */
  email: string;
}

/** How long the tick stays before the button offers itself again. */
const RESET_MS = 1600;

/** Two overlapping sheets. 16px grid, half-pixel coords so a 1.5px stroke lands crisp. */
const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" />
    {/* only the corner of the sheet behind, so the two don't cross-hatch */}
    <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 8.5l3.5 3.5L13 4" />
  </svg>
);

/**
 * A copy button beside the address, for the visitor a `mailto:` fails.
 *
 * That failure is quiet and common: on a desktop with no mail client registered
 * — which is most people who live in webmail — clicking the link either does
 * nothing at all or opens an Outlook they've never signed into. There's no
 * error, so it reads as a broken site rather than a missing handler. The
 * address is printed next to this in full and can always be selected by hand;
 * this just saves the drag.
 *
 * Deliberately not a contact form. A form here would mean either giving up the
 * static export or posting to a third party, plus widening a CSP that currently
 * says `connect-src 'self'` — and then owning spam forever. This costs a button.
 */
export const CopyEmail = ({ email }: CopyEmailProps) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The timeout outlives the component if a view switch lands inside the window.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Denied, or no clipboard at all (an insecure origin, an older browser).
      // Nothing to announce: the address is legible right there and the mailto
      // still works, and a tick that lied would be worse than no tick.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), RESET_MS);
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="copy-email"
        data-copied={copied}
        // The label carries the state as well as the action: the icon swap is
        // invisible to a screen reader, and `title` gives sighted visitors the
        // tooltip an unlabelled icon otherwise leaves them guessing at.
        aria-label={copied ? "Email address copied" : "Copy email address"}
        title={copied ? "Copied" : "Copy email address"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {/* A live region, because a changed aria-label on an already-focused
          button isn't reliably announced. Empty until there's news. */}
      <span className="sr-only" role="status">
        {copied ? "Email address copied" : ""}
      </span>
    </>
  );
};
