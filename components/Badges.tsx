import { PALETTE, fade } from "@/theme/palette";

interface BadgesProps {
  items: string[];
  className?: string;
}

/**
 * The pill row of headline skills, shared by both views so they can't drift.
 * Order and wording come from the badge line in `content/README.md`.
 */
export const Badges = ({ items, className }: BadgesProps) => (
  <div className={className} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {items.map((item) => (
      <span
        key={item}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: PALETTE.pink,
          border: `1px solid ${fade(PALETTE.pink, 40)}`,
          padding: "4px 10px",
          borderRadius: 3,
        }}
      >
        {item}
      </span>
    ))}
  </div>
);
