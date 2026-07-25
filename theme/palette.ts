/**
 * Design tokens for both views.
 *
 * The hex values live in `globals.css` `:root` — the single source of truth.
 * Everything here is a `var()` or `color-mix()` string, so a colour is only ever
 * written down once. That means these resolve to a real colour inside the
 * document (any inline `style` is fine) but are not plain hexes you could hand
 * to a canvas or a `<meta name="theme-color">`.
 */

export const PALETTE = {
  bg: "var(--bg)",
  terminalBg: "var(--terminal-bg)",
  cyan: "var(--cyan)",
  pink: "var(--pink)",
  purple: "var(--purple)",
  green: "var(--green)",
  /** The near-white core of the terminal's cursor-follow glow. */
  glow: "var(--glow)",
  white: "var(--white)",
  black: "var(--black)",
} as const;

/**
 * A base colour at partial alpha — `fade(PALETTE.cyan, 18)` replaces what would
 * otherwise be a hand-written `rgba(125,227,255,.18)` with the channel values
 * copied out of the palette by hand.
 */
export const fade = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/** The white text ramp, brightest to faintest. Use `fade` directly for one-offs. */
export const TEXT = {
  strong: PALETTE.white,
  /** Terminal output. */
  body: fade(PALETTE.white, 85),
  /** Classic-page list items. */
  primary: fade(PALETTE.white, 75),
  /** Contact values. */
  secondary: fade(PALETTE.white, 70),
  /** Running prose. */
  muted: fade(PALETTE.white, 60),
  /** Dimmed terminal lines. */
  soft: fade(PALETTE.white, 55),
  /** Labels and inactive controls. */
  dim: fade(PALETTE.white, 45),
  /** Field labels. */
  label: fade(PALETTE.white, 35),
  /** Faint terminal lines and hints. */
  faint: fade(PALETTE.white, 30),
  /** Footer small print. */
  ghost: fade(PALETTE.white, 25),
} as const;

/** Hairlines and dividers. */
export const BORDER = {
  subtle: fade(PALETTE.white, 7),
  soft: fade(PALETTE.white, 10),
  medium: fade(PALETTE.white, 12),
} as const;

export const LINE_COLORS = {
  cyan: PALETTE.cyan,
  pink: PALETTE.pink,
  purple: PALETTE.purple,
  green: PALETTE.green,
  dim: TEXT.soft,
  faint: TEXT.faint,
  text: TEXT.body,
  echo: PALETTE.green,
} as const;

/** The colour names a rendered line or segment may carry. */
export type LineColor = keyof typeof LINE_COLORS;
