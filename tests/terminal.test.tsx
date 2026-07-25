import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { Terminal } from "@/components/terminal/Terminal";
import type { Identity } from "@/modules/commands";
import type { ContentEntry } from "@/modules/vfs";

// next/navigation's useRouter isn't available outside the App Router runtime.
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ENTRIES: ContentEntry[] = [
  { path: "README.md", content: "# Home\nhello there" },
  { path: "work/README.md", content: "# Work\n- Roku" },
];

const IDENTITY: Identity = {
  name: "Ada Lovelace",
  headline: "Analyst @ Analytical Engine",
  contact: {
    email: "ada@example.dev",
    linkedin: "linkedin.com/in/ada",
    github: "github.com/ada",
    location: "London, UK",
    tagline: "Say hi.",
  },
};

const renderTerminal = () => render(<Terminal entries={ENTRIES} identity={IDENTITY} />);

describe("<Terminal />", () => {
  it("renders the welcome banner", () => {
    renderTerminal();
    expect(screen.getByText(/nandor-os v13\.2/)).toBeInTheDocument();
  });

  it("runs a command and shows its output", async () => {
    const user = userEvent.setup();
    renderTerminal();
    const input = screen.getByLabelText("terminal input");
    await user.click(input);
    await user.keyboard("ls{Enter}");
    expect(await screen.findByText("work/")).toBeInTheDocument();
  });

  it("cats a file's content", async () => {
    const user = userEvent.setup();
    renderTerminal();
    const input = screen.getByLabelText("terminal input");
    await user.click(input);
    await user.keyboard("cat README.md{Enter}");
    expect(await screen.findByText("hello there")).toBeInTheDocument();
  });

  it("clear wipes previous output", async () => {
    const user = userEvent.setup();
    renderTerminal();
    const input = screen.getByLabelText("terminal input");
    await user.click(input);
    await user.keyboard("ls{Enter}");
    expect(await screen.findByText("work/")).toBeInTheDocument();
    await user.keyboard("clear{Enter}");
    expect(screen.queryByText("work/")).not.toBeInTheDocument();
    expect(screen.queryByText(/nandor-os v13\.2/)).not.toBeInTheDocument();
  });

  it("recalls history with the up arrow", async () => {
    const user = userEvent.setup();
    renderTerminal();
    const input = screen.getByLabelText("terminal input") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("pwd{Enter}");
    await user.keyboard("{ArrowUp}");
    expect(input.value).toBe("pwd");
  });

  it("answers contact-me from the parsed content", async () => {
    const user = userEvent.setup();
    renderTerminal();
    await user.click(screen.getByLabelText("terminal input"));
    await user.keyboard("contact-me{Enter}");
    expect(await screen.findByText(new RegExp(IDENTITY.contact.email))).toBeInTheDocument();
  });

  it("renders the contact email as a mailto link", async () => {
    const user = userEvent.setup();
    renderTerminal();
    await user.click(screen.getByLabelText("terminal input"));
    await user.keyboard("contact-me{Enter}");
    const link = await screen.findByRole("link", { name: IDENTITY.contact.email });
    expect(link).toHaveAttribute("href", `mailto:${IDENTITY.contact.email}`);
  });

  it("opens external links in a new tab, but not mailto", async () => {
    const user = userEvent.setup();
    renderTerminal();
    await user.click(screen.getByLabelText("terminal input"));
    await user.keyboard("contact-me{Enter}");
    expect(await screen.findByRole("link", { name: IDENTITY.contact.github })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: IDENTITY.contact.email })).not.toHaveAttribute("target");
  });

  it("makes the hire-me address a mailto link", async () => {
    const user = userEvent.setup();
    renderTerminal();
    await user.click(screen.getByLabelText("terminal input"));
    await user.keyboard("hire-me{Enter}");
    const link = await screen.findByRole("link", { name: IDENTITY.contact.email });
    expect(link.getAttribute("href")).toContain("subject=");
  });

  it("announces output through a live region", () => {
    renderTerminal();
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
  });

  it("completes on Tab without wiping a trailing space", async () => {
    const user = userEvent.setup();
    renderTerminal();
    const input = screen.getByLabelText("terminal input") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("cat ");
    await user.keyboard("{Tab}");
    expect(input.value.startsWith("cat ")).toBe(true);
  });

  it("lets Shift+Tab move focus out of the input", async () => {
    const user = userEvent.setup();
    renderTerminal();
    const input = screen.getByLabelText("terminal input") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(input).not.toHaveFocus();
  });
});
