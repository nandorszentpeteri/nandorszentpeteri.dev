import { TEXT } from "@/theme/palette";

import { TypedRole } from "./TypedRole";

interface WhoamiHeaderProps {
  /** The `# Heading` of content/README.md — the same name `whoami` prints. */
  name: string;
  /** Break the name over two lines — fits the terminal view's narrow column. */
  stacked?: boolean;
  /** The name's font size; the classic hero has far more room than the column. */
  nameSize?: string;
}

/**
 * The identity header both views open with: the `$ whoami` prompt, the name, and
 * the self-typing role line. Shared so the two views can't drift apart.
 */
export const WhoamiHeader = ({ name, stacked = false, nameSize = "clamp(38px,6vw,60px)" }: WhoamiHeaderProps) => {
  // Stacking breaks after the first word, so a middle name would ride along with
  // the surname rather than stranding a line of its own.
  const [first, ...rest] = name.split(" ");

  return (
    <div className="whoami" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: TEXT.dim }}>$ whoami</div>
      {/* The size rides a custom property rather than `font-size` directly, so the
          phone breakpoint can shrink it without having to out-specify this inline
          style. The space before the <br> is what keeps the two words apart once
          the break is hidden on small screens. */}
      <h1
        className="whoami-name"
        style={{ ["--name-size" as string]: nameSize, margin: 0, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-.02em" }}
      >
        {first}{" "}
        {stacked ? <br className="whoami-break" /> : null}
        {rest.join(" ")}
      </h1>
      <TypedRole />
    </div>
  );
};
