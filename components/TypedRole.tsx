"use client";

import { useEffect, useState } from "react";

import { PALETTE, TEXT } from "@/theme/palette";

const WORDS = [
  "full-stack engineer",
  "agentic AI tinkerer",
  "mountain biker",
  "snowboarder",
  "gamer",
];

/** Survives a terminal↔classic switch; deliberately not localStorage, so a new
 *  tab still opens on the first word. */
const STORAGE_KEY = "typed-role";

type Progress = { index: number; shown: string; deleting: boolean };

/**
 * Where the line had got to when the last page unmounted, or null to start over.
 *
 * Validated rather than trusted: an entry written before `WORDS` was edited
 * would resume typing a word that no longer exists, or one whose prefix doesn't
 * match what's on screen. Anything unparseable is treated the same way — a
 * decorative line is never worth a thrown error.
 */
const readProgress = (): Progress | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Progress;
    return WORDS[saved.index]?.startsWith(saved.shown) ? saved : null;
  } catch {
    return null;
  }
};

/** Storage can throw (private mode, quota); the line just starts over if it does. */
const writeProgress = (progress: Progress) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* nothing to do — the animation is decorative */
  }
};

/**
 * The self-typing "// {role}" line under the name. Purely decorative.
 *
 * Every other animation on the site is switched off by a `prefers-reduced-motion`
 * rule in globals.css, but this one is driven by a JS timer that CSS can't reach —
 * so it asks the same question itself and rests on the first word instead.
 *
 * It also picks up where it left off across a terminal↔classic switch. Both
 * views render this line, so restarting from the first word on every navigation
 * announced that the page had been thrown away and rebuilt — which is exactly
 * what a single-page app is supposed to hide.
 */
export const TypedRole = () => {
  const [text, setText] = useState("");

  useEffect(() => {
    // Not a render-time check: matchMedia doesn't exist during the static export,
    // and branching on it in render would mismatch the prerendered HTML.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(WORDS[0]);
      return;
    }

    // One self-scheduling loop driven by local vars — NOT re-run per keystroke,
    // so each phase keeps its own timing (fast typing, long hold before switch).
    // Reading sessionStorage here rather than in `useState` for the same reason
    // as matchMedia above: the server rendered an empty line, and so must we.
    const resumed = readProgress();
    let timer: ReturnType<typeof setTimeout>;
    let wordIndex = resumed?.index ?? 0;
    let shown = resumed?.shown ?? "";
    let deleting = resumed?.deleting ?? false;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    // Paint the resumed text before the first tick, so the switch shows the word
    // already in place instead of a blank line for half a second.
    setText(shown);

    const tick = () => {
      const word = WORDS[wordIndex];
      let delay: number;

      if (!deleting) {
        shown = word.slice(0, shown.length + 1);
        if (shown === word) {
          // Word fully typed — hold it for a random 3–10s before erasing.
          deleting = true;
          delay = rand(3000, 10000);
        } else {
          delay = rand(35, 75); // fast typing
        }
      } else {
        shown = word.slice(0, shown.length - 1);
        if (shown === "") {
          deleting = false;
          wordIndex = (wordIndex + 1) % WORDS.length;
          delay = rand(400, 700);
        } else {
          delay = rand(20, 40); // fast deleting
        }
      }

      setText(shown);
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 500);
    return () => {
      clearTimeout(timer);
      // Saved once, on the way out, rather than on every keystroke — a write
      // every 40ms would be pure waste for something only read on navigation.
      //
      // `deleting` is dropped while the word is fully typed: that state means
      // "holding before erasing", and the hold's remaining time isn't saved.
      // Persisting it would have the line start erasing the moment the new page
      // appeared. Reported as not-yet-deleting, the first tick re-enters the
      // hold and the word sits there as it should.
      writeProgress({ index: wordIndex, shown, deleting: deleting && shown !== WORDS[wordIndex] });
    };
  }, []);

  return (
    // Type scale lives in globals.css so it can step down on phones; the caret
    // below is sized in em so it follows without a second breakpoint.
    <div className="typed-role">
      <span style={{ color: TEXT.dim }}>// </span>
      <span className="gradient-text">{text}</span>
      {/* White, not an accent: the word it trails is already painted with the
          brand ramp, and a cyan block on the end of it read as one more colour
          in the line rather than as a caret. */}
      <span
        className="cursor-blink"
        style={{
          display: "inline-block",
          width: "0.55em",
          height: "1em",
          background: PALETTE.white,
          marginLeft: 3,
          verticalAlign: -2,
        }}
      />
    </div>
  );
};
