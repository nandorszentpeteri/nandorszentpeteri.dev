import type { OutputLine } from "@/modules/commands";
import { LINE_COLORS } from "@/theme/palette";

interface TerminalLineProps {
  line: OutputLine;
  /** Font size in px; the classic page renders the same lines a touch smaller. */
  size?: number;
}

/** Renders one terminal line — either a single colour or highlighted segments. */
export const TerminalLine = ({ line, size = 13 }: TerminalLineProps) => {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: size,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: LINE_COLORS[line.color ?? "text"],
    // A line that says where its continuation belongs gets a hanging indent:
    // the padding moves the whole block right and the negative text-indent
    // pulls the first line back out, so only the overflow is indented. In `ch`
    // because the column is a character count, and this has to hold whatever
    // the reader's font scaling does to the pixel size. See OutputLine.
    ...(line.wrapIndent
      ? { paddingLeft: `${line.wrapIndent}ch`, textIndent: `-${line.wrapIndent}ch` }
      : null),
  };

  // `term-wide` is the whole of the shell's responsive story: the line said it
  // was optional, and the stylesheet drops it on a narrow screen.
  if (!line.segments) {
    return (
      <div className={line.wide ? "term-wide" : undefined} style={base}>
        {line.text || " "}
      </div>
    );
  }

  return (
    <div className={line.wide ? "term-wide" : undefined} style={base}>
      {line.segments.map((seg, i) => {
        const style: React.CSSProperties = {
          color: LINE_COLORS[seg.color ?? line.color ?? "text"],
          fontWeight: seg.bold ? 700 : undefined,
        };

        if (!seg.href) {
          return (
            <span key={i} className={seg.wide ? "term-wide" : undefined} style={style}>
              {seg.text}
            </span>
          );
        }

        // `.link` is the site-wide treatment: plain until hover, which suits a
        // terminal — an always-underlined run would read as markup, not output.
        // mailto stays in this tab; a new tab for it would leave a blank one behind.
        const newTab = !seg.href.startsWith("mailto:");
        return (
          <a
            key={i}
            className="link"
            href={seg.href}
            {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            style={{ ...style, cursor: "pointer" }}
          >
            {seg.text}
          </a>
        );
      })}
    </div>
  );
};
