import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

import { CopyEmail } from "@/components/CopyEmail";

const EMAIL = "ada@example.dev";

/** Swap in a clipboard; jsdom ships none, and a real one would need a user gesture. */
const stubClipboard = (writeText: () => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

const button = () => screen.getByRole("button");

// fireEvent rather than userEvent: userEvent drives its own timers, which
// fights the fake ones the reset window needs.
const click = () => act(() => void button().click());

/** The click handler awaits the clipboard; flush that microtask. Not a timer, so
 *  it settles under fake timers without advancing the clock. */
const settle = async () => act(async () => undefined);

// Faked from the start, not partway through: the reset is scheduled inside the
// click handler, and a timer booked on the real clock can't be advanced by a
// fake one installed afterwards.
beforeEach(() => {
  vi.useFakeTimers();
  stubClipboard(() => Promise.resolve());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CopyEmail — copying", () => {
  it("puts the address on the clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(EMAIL);
  });

  it("confirms in its accessible name, which the icon swap can't do", async () => {
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    expect(button()).toHaveAccessibleName("Email address copied");
  });

  it("announces the confirmation in a live region", async () => {
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Email address copied");
  });

  it("offers itself as a copy button before anything is clicked", () => {
    render(<CopyEmail email={EMAIL} />);
    expect(button()).toHaveAccessibleName("Copy email address");
  });

  it("says nothing before anything is clicked", () => {
    render(<CopyEmail email={EMAIL} />);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("CopyEmail — going quiet again", () => {
  it("returns to offering a copy after the reset window", async () => {
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    act(() => vi.advanceTimersByTime(2000));
    expect(button()).toHaveAccessibleName("Copy email address");
  });

  it("stays confirmed until the window elapses", async () => {
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    act(() => vi.advanceTimersByTime(500));
    expect(button()).toHaveAccessibleName("Email address copied");
  });
});

// A tick that lied would be worse than no tick: the address is legible beside
// this and the mailto still works, so a failure has somewhere to fall back to.
describe("CopyEmail — when the clipboard refuses", () => {
  it("claims nothing was copied", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    expect(button()).toHaveAccessibleName("Copy email address");
  });

  it("announces nothing", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    render(<CopyEmail email={EMAIL} />);
    click();
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("does not throw at the user", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    render(<CopyEmail email={EMAIL} />);
    expect(() => click()).not.toThrow();
    await settle();
  });
});
