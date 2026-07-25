"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { runCommand, complete, type Identity, type OutputLine } from "@/modules/commands";
import { buildVfs, displayPath, HOME_PATH, type ContentEntry } from "@/modules/vfs";
import { PALETTE, TEXT, fade } from "@/theme/palette";

import { Less } from "./Less";
import { TerminalLine } from "./TerminalLine";

const BANNER: OutputLine[] = [
  { text: "nandor-os v13.2 (c) 2026 — welcome.", color: "faint" },
  { text: 'type "help" to list commands, "ls" to look around, or "gui" for the classic page.', color: "faint" },
  { text: "", color: "faint" },
];

type LogLine = OutputLine & { key: number };

interface TerminalProps {
  entries: ContentEntry[];
  /** Name, headline and contact details, parsed from content/*.md at build time. */
  identity: Identity;
}

export const Terminal = ({ entries, identity }: TerminalProps) => {
  const router = useRouter();
  const vfs = useMemo(() => buildVfs(entries), [entries]);

  const [lines, setLines] = useState<LogLine[]>(() => BANNER.map((l, i) => ({ ...l, key: i })));
  const [val, setVal] = useState("");
  // Column (character index) of the text caret. The <input> is an invisible
  // keystroke/selection catcher; we render the text ourselves in an overlay and
  // draw a block cursor over the character at this column (solid when focused,
  // hollow otherwise) — the standard web-terminal technique.
  const [caretPos, setCaretPos] = useState(0);
  const [focused, setFocused] = useState(false);
  const [cwd, setCwd] = useState(HOME_PATH);
  const prevCwd = useRef(HOME_PATH);
  const history = useRef<string[]>([]);
  const histIndex = useRef(-1);
  const keySeq = useRef(BANNER.length);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pager, setPager] = useState<{ title: string; lines: OutputLine[] } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const syncCaret = (el: HTMLInputElement | null) => {
    if (!el) return;
    setCaretPos(el.selectionStart ?? el.value.length);
  };

  const pushLines = (incoming: OutputLine[]) => {
    // Keys are taken before the updater runs: React invokes updaters twice in
    // StrictMode, and a `keySeq.current++` inside one would burn two keys per
    // line and leave the counter ahead of the log.
    const keyed = incoming.map((l) => ({ ...l, key: keySeq.current++ }));
    setLines((prev) => [...prev, ...keyed]);
  };

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);

  // Land in the prompt so the page can be typed into straight away — the whole
  // point of it. Not on touch devices: focusing an input there summons the
  // on-screen keyboard over half the screen before anyone has asked to type.
  // preventScroll because the prompt sits below the fold on a short window, and
  // focus would otherwise jump the page past the identity block.
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // The `gui` command navigates on a delay so its "launching…" line is readable;
  // if the component goes away first, the pending push has to go with it.
  useEffect(() => () => {
    if (navTimer.current) clearTimeout(navTimer.current);
  }, []);

  const submit = () => {
    const raw = val;
    const prompt = `${displayPath(cwd)} $ ${raw}`;

    if (raw.trim() !== "") {
      history.current = [raw, ...history.current];
    }
    histIndex.current = -1;
    setCaretPos(0);

    const result = runCommand(vfs, { cwd, identity }, raw, prevCwd.current);

    if (result.clear) {
      setLines([]);
      setVal("");
      return;
    }

    pushLines([{ text: prompt, color: "echo" }, ...result.lines]);
    setVal("");

    if (result.cwd !== cwd) {
      prevCwd.current = cwd;
      setCwd(result.cwd);
    }
    if (result.pager) setPager(result.pager);
    if (result.navigate) {
      const destination = result.navigate;
      navTimer.current = setTimeout(() => router.push(destination), 500);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      submit();
      return;
    }
    // Tab completes, but Shift+Tab is left alone: swallowing it too would trap
    // keyboard users in the input with no way back out of the page (WCAG 2.1.2).
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const res = complete(vfs, cwd, val);
      if (res.replacement && res.replacement !== val) {
        setVal(res.replacement);
        setCaretPos(res.replacement.length);
      } else if (res.completions.length > 1) {
        pushLines([
          { text: `${displayPath(cwd)} $ ${val}`, color: "echo" },
          { text: res.completions.join("   "), color: "dim" },
        ]);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = history.current;
      if (h.length) {
        const n = Math.min(histIndex.current + 1, h.length - 1);
        histIndex.current = n;
        setVal(h[n]);
        setCaretPos(h[n].length);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIndex.current > 0) {
        histIndex.current -= 1;
        setVal(history.current[histIndex.current]);
      } else {
        histIndex.current = -1;
        setVal("");
      }
      setCaretPos(histIndex.current >= 0 ? history.current[histIndex.current].length : 0);
      return;
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  // Track the mouse across the whole window so the border ring lights up as the
  // cursor *approaches* the terminal from outside, not only once it's inside.
  // Restyling on every mousemove repaints far more often than the display can
  // show, so the work is coalesced onto one animation frame.
  useEffect(() => {
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const paint = () => {
      frame = 0;
      const wrap = wrapRef.current;
      const ring = ringRef.current;
      if (!wrap || !ring || !pending) return;
      const r = wrap.getBoundingClientRect();
      const x = pending.x - r.left;
      const y = pending.y - r.top;
      const inX = Math.min(Math.abs(x), Math.abs(x - r.width));
      const inY = Math.min(Math.abs(y), Math.abs(y - r.height));
      const inside = x >= 0 && x <= r.width && y >= 0 && y <= r.height;
      const d = inside
        ? Math.min(inX, inY)
        : Math.hypot(Math.max(0, -x, x - r.width), Math.max(0, -y, y - r.height));
      ring.style.opacity = Math.max(0, 1 - d / 180).toFixed(3);
      ring.style.background = `radial-gradient(180px circle at ${Math.round(x)}px ${Math.round(
        y,
      )}px, ${PALETTE.glow}, ${fade(PALETTE.cyan, 70)} 45%, ${fade(PALETTE.green, 30)} 65%, transparent 80%)`;
    };

    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        ref={wrapRef}
        // While the pager is up it owns the keyboard; stealing focus back to the
        // hidden prompt on any click (selecting text, say) would kill q/Escape.
        onClick={() => {
          if (!pager) inputRef.current?.focus();
        }}
        style={{
          position: "relative",
          border: `1px solid ${fade(PALETTE.cyan, 22)}`,
          borderRadius: 12,
          background: PALETTE.terminalBg,
          boxShadow: `0 18px 50px ${fade(PALETTE.black, 55)},0 4px 14px ${fade(PALETTE.black, 40)}`,
          overflow: "hidden",
          cursor: "text",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: `1px solid ${fade(PALETTE.cyan, 18)}`,
            background: fade(PALETTE.cyan, 4),
            flexShrink: 0,
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: PALETTE.pink, opacity: 0.8 }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: PALETTE.purple, opacity: 0.8 }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: PALETTE.cyan, opacity: 0.8 }} />
          <span style={{ marginLeft: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: TEXT.faint }}>
            guest@nandor
          </span>
        </div>

        {/* scroll area */}
        <div
          ref={boxRef}
          className="term-scroll"
          // padding lives in .term-scroll so it can tighten on phones
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* The command log is the whole interactive surface of this page, so it
              announces itself: without a live region a screen reader hears
              nothing at all after pressing Enter. */}
          <div
            role="log"
            aria-live="polite"
            aria-label="terminal output"
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            {lines.map((ln) => (
              <TerminalLine key={ln.key} line={ln} />
            ))}
          </div>

          {/* live prompt */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: PALETTE.cyan, marginRight: 8 }}>
              {displayPath(cwd)}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 13, color: PALETTE.green, marginRight: 8 }}>
              $
            </span>
            <span style={{ position: "relative", display: "inline-block", minWidth: "1ch" }}>
              <input
                ref={inputRef}
                value={val}
                onChange={(e) => {
                  setVal(e.target.value);
                  syncCaret(e.target);
                }}
                onKeyDown={onKeyDown}
                onKeyUp={(e) => syncCaret(e.currentTarget)}
                onClick={(e) => syncCaret(e.currentTarget)}
                onSelect={(e) => syncCaret(e.currentTarget)}
                onFocus={(e) => {
                  setFocused(true);
                  syncCaret(e.currentTarget);
                }}
                onBlur={() => setFocused(false)}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="terminal input"
                style={{
                  // width tracks length exactly so the wrapper sizes to the text.
                  width: `${val.length}ch`,
                  minWidth: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  lineHeight: "18px",
                  color: "transparent", // real text is drawn by the overlay below
                  caretColor: "transparent",
                }}
              />
              {/* Overlay: renders the text and a true block cursor over the
                  character at the caret (inverted colours, not a blend). */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "pre",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  lineHeight: "18px",
                  color: TEXT.strong,
                  pointerEvents: "none",
                }}
              >
                {val.slice(0, caretPos)}
                <span
                  className={focused ? "cursor-blink" : undefined}
                  // White rather than an accent, matching a real terminal caret
                  // — and it stops the block reading as a highlight/selection.
                  style={
                    focused
                      ? { background: PALETTE.white, color: PALETTE.terminalBg }
                      : { boxShadow: `inset 0 0 0 1px ${PALETTE.white}`, color: TEXT.strong }
                  }
                >
                  {val.slice(caretPos, caretPos + 1) || " "}
                </span>
                {val.slice(caretPos + 1)}
              </span>
            </span>
          </div>
        </div>

        {/* cursor glow ring */}
        <div
          ref={ringRef}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            padding: "1.5px",
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity .15s",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {pager && (
          <Less
            title={pager.title}
            lines={pager.lines}
            onQuit={() => {
              setPager(null);
              inputRef.current?.focus();
            }}
          />
        )}
      </div>

      <div style={{ marginTop: 10, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: TEXT.faint, textAlign: "right" }}>
        {/* The two plain lookups sit a step above the surrounding faint text but
            take no accent — colouring all four flattened the row into a strip of
            neon where nothing stood out. The accents are kept for the two that
            actually go somewhere: hire-me opens a mail draft, gui leaves the
            terminal behind. */}
        <span style={{ color: TEXT.secondary }}>help</span> ·
        <span style={{ color: TEXT.secondary }}>whoami</span> ·
        <span style={{ color: PALETTE.green }}>hire-me</span> ·
        prefer scrolling? <span style={{ color: PALETTE.pink }}>gui</span>
      </div>
    </div>
  );
};
