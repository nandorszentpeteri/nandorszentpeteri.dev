"use client";

import { useEffect, useRef } from "react";

import type { OutputLine } from "@/modules/commands";
import { PALETTE } from "@/theme/palette";

import { TerminalLine } from "./TerminalLine";

interface LessProps {
  title: string;
  lines: OutputLine[];
  onQuit: () => void;
}

/**
 * A minimal `less`-style pager. Fills the terminal box, shows the file with the
 * same syntax highlighting as `cat`, and quits on `q` / Escape. Arrow keys,
 * PageUp/PageDown and Space/b move around.
 */
export const Less = ({ title, lines, onQuit }: LessProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const quitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // The dialog has exactly two focusable elements; cycle Tab between them so
  // focus can't escape to the terminal buried underneath (aria-modal promises
  // as much to assistive tech).
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    (document.activeElement === ref.current ? quitRef : ref).current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const line = 22;
    const page = el.clientHeight - line;
    switch (e.key) {
      case "q":
      case "Escape":
        e.preventDefault();
        onQuit();
        break;
      case "ArrowDown":
      case "j":
        e.preventDefault();
        el.scrollTop += line;
        break;
      case "ArrowUp":
      case "k":
        e.preventDefault();
        el.scrollTop -= line;
        break;
      case " ":
      case "PageDown":
        e.preventDefault();
        el.scrollTop += page;
        break;
      case "b":
      case "PageUp":
        e.preventDefault();
        el.scrollTop -= page;
        break;
      case "g":
        e.preventDefault();
        el.scrollTop = 0;
        break;
      case "G":
        e.preventDefault();
        el.scrollTop = el.scrollHeight;
        break;
    }
  };

  return (
    <div
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: PALETTE.terminalBg, zIndex: 5 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${title}`}
      onKeyDown={trapTab}
    >
      <div
        ref={ref}
        className="term-scroll"
        tabIndex={0}
        onKeyDown={onKeyDown}
        // padding lives in .term-scroll so it can tighten on phones
        style={{ flex: 1, overflowY: "auto", outline: "none", display: "flex", flexDirection: "column", gap: 4 }}
      >
        {lines.map((line, i) => (
          <TerminalLine key={i} line={line} />
        ))}
      </div>
      <div
        style={{
          padding: "8px 16px",
          background: PALETTE.cyan,
          color: PALETTE.terminalBg,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        <button
          ref={quitRef}
          onClick={onQuit}
          style={{ background: "transparent", border: "none", color: PALETTE.terminalBg, font: "inherit", cursor: "pointer", padding: 0 }}
        >
          press q to quit
        </button>
      </div>
    </div>
  );
};
