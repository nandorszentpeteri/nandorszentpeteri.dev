import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Terminal from "@/components/terminal/Terminal";
import type { ContentEntry } from "@/modules/vfs";

// next/navigation's useRouter isn't available outside the App Router runtime.
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ENTRIES: ContentEntry[] = [
  { path: "README.md", content: "# Home\nhello there" },
  { path: "work/README.md", content: "# Work\n- Roku" },
];

describe("<Terminal />", () => {
  it("renders the welcome banner", () => {
    render(<Terminal entries={ENTRIES} />);
    expect(screen.getByText(/nandor-os v13\.2/)).toBeInTheDocument();
  });

  it("runs a command and shows its output", async () => {
    const user = userEvent.setup();
    render(<Terminal entries={ENTRIES} />);
    const input = screen.getByLabelText("terminal input");
    await user.click(input);
    await user.keyboard("ls{Enter}");
    expect(await screen.findByText("work/")).toBeInTheDocument();
  });

  it("cats a file's content", async () => {
    const user = userEvent.setup();
    render(<Terminal entries={ENTRIES} />);
    const input = screen.getByLabelText("terminal input");
    await user.click(input);
    await user.keyboard("cat README.md{Enter}");
    expect(await screen.findByText("hello there")).toBeInTheDocument();
  });

  it("clear wipes previous output", async () => {
    const user = userEvent.setup();
    render(<Terminal entries={ENTRIES} />);
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
    render(<Terminal entries={ENTRIES} />);
    const input = screen.getByLabelText("terminal input") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("pwd{Enter}");
    await user.keyboard("{ArrowUp}");
    expect(input.value).toBe("pwd");
  });
});
