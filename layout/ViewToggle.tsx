import Link from "next/link";

import { PALETTE, TEXT, fade } from "@/theme/palette";

interface ViewToggleProps {
  active: "terminal" | "classic";
}

/** The terminal | classic switch in the top-right of both views. */
export const ViewToggle = ({ active }: ViewToggleProps) => {
  // Padding and font size live in globals.css (.view-toggle / .view-tab-cell) so
  // they can shrink on phones — an inline size would win over the media query.
  const tab = (label: string, current: boolean) => ({
    color: current ? PALETTE.cyan : TEXT.dim,
    background: current ? fade(PALETTE.cyan, 14) : "transparent",
    borderLeft: label === "classic" ? `1px solid ${fade(PALETTE.cyan, 30)}` : undefined,
    transition: "color .2s",
  });

  return (
    <div className="view-toggle" style={{ border: `1px solid ${fade(PALETTE.cyan, 30)}` }}>
      {active === "terminal" ? (
        <span className="view-tab-cell" style={tab("terminal", true)}>
          terminal
        </span>
      ) : (
        <Link className="view-tab view-tab-cell" href="/" style={tab("terminal", false)}>
          terminal
        </Link>
      )}
      {active === "classic" ? (
        <span className="view-tab-cell" style={tab("classic", true)}>
          classic
        </span>
      ) : (
        <Link className="view-tab view-tab-cell" href="/classic/" style={tab("classic", false)}>
          classic
        </Link>
      )}
    </div>
  );
};
