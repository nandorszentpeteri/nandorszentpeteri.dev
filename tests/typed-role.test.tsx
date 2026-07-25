import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { TypedRole } from "@/components/TypedRole";

const STORAGE_KEY = "typed-role";

/** A word from the real WORDS list; the component validates against it. */
const WORD = "snowboarder";

const stored = () => JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");

const store = (progress: unknown) => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

// The line paints its resumed text synchronously on mount, but everything after
// that is on a timer — fake them so no test waits on a 3-10s hold.
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TypedRole — resuming across a page switch", () => {
  it("picks up mid-word where the last page left off", () => {
    store({ index: 3, shown: "snowboa", deleting: false });
    render(<TypedRole />);
    expect(screen.getByText("snowboa")).toBeInTheDocument();
  });

  it("starts from nothing when there is no stored progress", () => {
    const { container } = render(<TypedRole />);
    expect(container.querySelector(".gradient-text")).toHaveTextContent("");
  });

  // WORDS is edited from time to time; an entry written before an edit would
  // otherwise resume typing a word that no longer exists at that index.
  it("ignores progress whose text no longer matches the word at that index", () => {
    store({ index: 3, shown: "kitesurf", deleting: false });
    const { container } = render(<TypedRole />);
    expect(container.querySelector(".gradient-text")).toHaveTextContent("");
  });

  it("ignores progress pointing past the end of the word list", () => {
    store({ index: 99, shown: "whatever", deleting: false });
    const { container } = render(<TypedRole />);
    expect(container.querySelector(".gradient-text")).toHaveTextContent("");
  });

  it("ignores unparseable stored progress rather than throwing", () => {
    sessionStorage.setItem(STORAGE_KEY, "not json");
    expect(() => render(<TypedRole />)).not.toThrow();
  });
});

describe("TypedRole — saving on the way out", () => {
  it("writes its progress when it unmounts", () => {
    store({ index: 3, shown: "snowboa", deleting: false });
    render(<TypedRole />).unmount();
    expect(stored()).toMatchObject({ index: 3, shown: "snowboa" });
  });

  it("writes nothing but the current word index, not a whole history", () => {
    store({ index: 3, shown: "snowboa", deleting: false });
    render(<TypedRole />).unmount();
    expect(Object.keys(stored()).sort()).toEqual(["deleting", "index", "shown"]);
  });

  // "deleting" on a fully-typed word means "holding before erasing", and the
  // hold's remaining time isn't saved — so persisting it would have the next
  // page start erasing on arrival instead of showing the word.
  it("reports a fully-typed word as not yet deleting, so the hold restarts", () => {
    store({ index: 3, shown: WORD, deleting: true });
    render(<TypedRole />).unmount();
    expect(stored().deleting).toBe(false);
  });

  it("keeps the deleting flag while a word is only partly erased", () => {
    store({ index: 3, shown: "snowboa", deleting: true });
    render(<TypedRole />).unmount();
    expect(stored().deleting).toBe(true);
  });
});

describe("TypedRole — reduced motion", () => {
  const reduceMotion = () => vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);

  it("rests on the first word", () => {
    const matchMedia = reduceMotion();
    render(<TypedRole />);
    expect(screen.getByText("full-stack engineer")).toBeInTheDocument();
    matchMedia.mockRestore();
  });

  // The effect returns early, so there's no loop to save — and nothing should
  // be written, or the next page would resume a word this reader never saw type.
  it("saves nothing on unmount", () => {
    const matchMedia = reduceMotion();
    render(<TypedRole />).unmount();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    matchMedia.mockRestore();
  });
});
