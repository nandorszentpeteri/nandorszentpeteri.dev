import type { Metadata } from "next";
import Link from "next/link";

import { TerminalLine } from "@/components/terminal/TerminalLine";
import { NeonBackground } from "@/layout/NeonBackground";
import type { OutputLine } from "@/modules/commands";
import { PALETTE, TEXT, fade } from "@/theme/palette";

export const metadata: Metadata = {
  title: "404 — no such file or directory",
  description: "That path isn't on this filesystem.",
};

/**
 * The shell can't run here — a static export serves one 404.html for every bad
 * path, so it can't echo back the path that was asked for. It's a transcript of
 * a session that already happened, rendered by the same TerminalLine the real
 * shell uses so the colours can't drift.
 */
const TRANSCRIPT: OutputLine[] = [
  { text: "~ $ cd $REQUESTED_PATH", color: "echo" },
  { text: "cd: no such file or directory", color: "pink" },
  { text: "", color: "text" },
  { text: "that page isn't mounted on this filesystem.", color: "dim" },
  { text: "everything worth reading lives under ~ — head back and have a look.", color: "faint" },
];

const NotFound = () => (
  <div
    style={{
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      overflow: "hidden",
    }}
  >
    <NeonBackground />

    <main style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 620 }}>
      <div
        style={{
          border: `1px solid ${fade(PALETTE.cyan, 22)}`,
          borderRadius: 12,
          background: PALETTE.terminalBg,
          boxShadow: `0 18px 50px ${fade(PALETTE.black, 55)},0 4px 14px ${fade(PALETTE.black, 40)}`,
          overflow: "hidden",
        }}
      >
        {/* title bar — the same three dots as the real terminal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: `1px solid ${fade(PALETTE.cyan, 18)}`,
            background: fade(PALETTE.cyan, 4),
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: PALETTE.pink, opacity: 0.8 }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: PALETTE.purple, opacity: 0.8 }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: PALETTE.cyan, opacity: 0.8 }} />
          <span style={{ marginLeft: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: TEXT.faint }}>
            guest@nandor
          </span>
        </div>

        <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1.1,
              color: PALETTE.pink,
              marginBottom: 12,
            }}
          >
            404
          </div>

          {TRANSCRIPT.map((line, i) => (
            <TerminalLine key={i} line={line} />
          ))}

          <div style={{ display: "flex", gap: 18, marginTop: 22, fontFamily: "var(--font-mono)", fontSize: 13 }}>
            <Link className="link" href="/" style={{ color: PALETTE.cyan }}>
              cd ~
            </Link>
            <Link className="link" href="/classic/" style={{ color: PALETTE.green }}>
              gui
            </Link>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: TEXT.faint, textAlign: "right" }}>
        lost? <span style={{ color: PALETTE.cyan }}>cd ~</span> takes you home.
      </div>
    </main>
  </div>
);

export default NotFound;
