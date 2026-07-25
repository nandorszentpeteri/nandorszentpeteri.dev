import { TEXT } from "@/theme/palette";

import { TypedRole } from "./TypedRole";

/** Lives in public/, so the src is the served path rather than a bundled import. */
const PORTRAIT = "/nandor-szentpeteri.jpg";

interface WhoamiHeaderProps {
  /** The `# Heading` of content/README.md — the same name `whoami` prints. */
  name: string;
  /** The name's font size; the classic hero has far more room than the column. */
  nameSize?: string;
  /** Both pages pass the entrance here rather than to a parent — see below. */
  className?: string;
}

/**
 * The identity header both views open with: the `$ whoami` prompt, the name, and
 * the self-typing role line. Shared so the two views can't drift apart.
 *
 * Both pages hand this its own entrance class instead of animating a container
 * around it. Opacity inherits, so a fade on any ancestor would take these three
 * elements with it — and on a phone they're the one thing that must not fade,
 * being identical across a terminal↔classic switch.
 */
export const WhoamiHeader = ({ name, nameSize = "clamp(30px,4.2vw,46px)", className }: WhoamiHeaderProps) => (
  <div className={`whoami${className ? ` ${className}` : ""}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: TEXT.dim }}>$ whoami</div>
    {/* The name and the role share a column so the portrait can stand against
        both. The portrait leads: with alt="" it is out of the accessibility
        tree, so putting it first costs a screen reader nothing. */}
    <div className="whoami-row">
      {/* alt is empty on purpose: the <h1> beside it already gives the name, and
          a screen reader announcing it twice is noise, not information. */}
      <span className="whoami-avatar">
        <img src={PORTRAIT} alt="" width={320} height={320} />
      </span>
      <div className="whoami-titles">
        {/* The size rides a custom property rather than `font-size` directly, so
            the phone breakpoint can shrink it without having to out-specify this
            inline style. */}
        <h1
          className="whoami-name"
          style={{ ["--name-size" as string]: nameSize, margin: 0, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-.02em" }}
        >
          {name}
        </h1>
        <TypedRole />
      </div>
    </div>
  </div>
);
