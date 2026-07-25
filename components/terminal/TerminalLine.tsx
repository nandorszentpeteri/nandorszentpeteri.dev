import { LINE_COLORS } from "@/theme/palette";
import type { OutputLine } from "@/modules/commands";

/** Renders one terminal line — either a single colour or highlighted segments. */
export default function TerminalLine({ line, size = 13 }: { line: OutputLine; size?: number }) {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: size,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: LINE_COLORS[line.color ?? "text"],
  };

  if (!line.segments) {
    return <div style={base}>{line.text || " "}</div>;
  }

  return (
    <div style={base}>
      {line.segments.map((seg, i) => (
        <span
          key={i}
          style={{
            color: LINE_COLORS[seg.color ?? line.color ?? "text"],
            fontWeight: seg.bold ? 700 : undefined,
          }}
        >
          {seg.text}
        </span>
      ))}
    </div>
  );
}
