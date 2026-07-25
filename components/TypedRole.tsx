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

/** The self-typing "// {role}" line under the name. Purely decorative. */
export default function TypedRole() {
  const [text, setText] = useState("");

  useEffect(() => {
    // One self-scheduling loop driven by local vars — NOT re-run per keystroke,
    // so each phase keeps its own timing (fast typing, long hold before switch).
    let timer: ReturnType<typeof setTimeout>;
    let wordIndex = 0;
    let shown = "";
    let deleting = false;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const tick = () => {
      const word = WORDS[wordIndex];
      let delay: number;

      if (!deleting) {
        shown = word.slice(0, shown.length + 1);
        if (shown === word) {
          // Word fully typed — hold it for a random 5–20s before erasing.
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
    return () => clearTimeout(timer);
  }, []);

  return (
    // Type scale lives in globals.css so it can step down on phones; the caret
    // below is sized in em so it follows without a second breakpoint.
    <div className="typed-role">
      <span style={{ color: TEXT.dim }}>// </span>
      <span className="gradient-text">
        {text}
      </span>
      <span
        className="cursor-blink"
        style={{
          display: "inline-block",
          width: "0.55em",
          height: "1em",
          background: PALETTE.cyan,
          marginLeft: 3,
          verticalAlign: -2,
        }}
      />
    </div>
  );
}
