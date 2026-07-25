import { describe, it, expect } from "vitest";
import { buildVfs, HOME_PATH, type ContentEntry } from "@/modules/vfs";
import { runCommand, complete, renderMarkdownLines, parseInline, type Identity } from "@/modules/commands";

// Mirrors the real content shape: single-file sections at home, plus the
// writings/ directory for cd/ls to have something to walk into.
const ENTRIES: ContentEntry[] = [
  { path: "README.md", content: "# Home\nwelcome home" },
  { path: "work.md", content: "# Work\n- Roku" },
  { path: "skills.md", content: "# Skills\nTypeScript" },
  { path: "writings/README.md", content: "# Writings\n- posts" },
  { path: "writings/webrtc.md", content: "# WebRTC\ndraft notes" },
];

// Deliberately not Nandor's real details: these assertions must fail if the
// shell ever goes back to printing a hardcoded address instead of the content.
const IDENTITY: Identity = {
  name: "Ada Lovelace",
  headline: "Analyst @ Analytical Engine · London, UK",
  contact: {
    email: "ada@example.dev",
    linkedin: "linkedin.com/in/ada",
    github: "github.com/ada",
    location: "London, UK",
    tagline: "Say hi.",
    taglineCta: "",
  },
};

const root = buildVfs(ENTRIES);
const home = { cwd: HOME_PATH, identity: IDENTITY };
const writings = { cwd: `${HOME_PATH}/writings`, identity: IDENTITY };
const text = (r: ReturnType<typeof runCommand>) => r.lines.map((l) => l.text).join("\n");

describe("runCommand — navigation", () => {
  it("ls lists directories then files", () => {
    const r = runCommand(root, home, "ls");
    const texts = r.lines.map((l) => l.text);
    expect(texts).toContain("writings/");
    expect(texts).toContain("README.md");
    expect(texts).toContain("work.md");
    // directory listed before file
    expect(texts.indexOf("writings/")).toBeLessThan(texts.indexOf("README.md"));
  });

  it("ls reports missing paths", () => {
    const r = runCommand(root, home, "ls nope");
    expect(text(r)).toMatch(/no such file or directory/);
  });

  it("cd changes the working directory", () => {
    const r = runCommand(root, home, "cd writings");
    expect(r.cwd).toBe(`${HOME_PATH}/writings`);
  });

  it("cd with no argument returns home", () => {
    const r = runCommand(root, writings, "cd");
    expect(r.cwd).toBe(HOME_PATH);
  });

  it("cd into a file errors and keeps cwd", () => {
    const r = runCommand(root, home, "cd README.md");
    expect(r.cwd).toBe(HOME_PATH);
    expect(text(r)).toMatch(/not a directory/);
  });

  it("cd - jumps to the previous directory", () => {
    const r = runCommand(root, writings, "cd -", HOME_PATH);
    expect(r.cwd).toBe(HOME_PATH);
  });

  it("pwd prints the absolute cwd", () => {
    const r = runCommand(root, writings, "pwd");
    expect(text(r)).toBe(`${HOME_PATH}/writings`);
  });
});

describe("runCommand — files", () => {
  it("cat highlights the raw markdown source, keeping the markers", () => {
    const r = runCommand(root, home, "cat README.md");
    expect(text(r)).toContain("# Home"); // heading marker kept verbatim (source view)
    expect(text(r)).toContain("welcome home");
    const heading = r.lines.find((l) => l.text === "# Home");
    expect(heading?.color).toBe("cyan"); // but it's syntax-highlighted
    expect(heading?.segments).toBeTruthy();
  });

  it("cat resolves relative paths from cwd", () => {
    const r = runCommand(root, writings, "cat webrtc.md");
    expect(text(r)).toContain("WebRTC");
  });

  it("cat on a directory errors", () => {
    const r = runCommand(root, home, "cat writings");
    expect(text(r)).toMatch(/is a directory/);
  });

  it("cat on a missing file errors", () => {
    const r = runCommand(root, home, "cat ghost.md");
    expect(text(r)).toMatch(/no such file or directory/);
  });

  it("less opens the pager with the rendered view (markers stripped)", () => {
    const r = runCommand(root, home, "less README.md");
    expect(r.pager).toBeTruthy();
    const joined = r.pager?.lines.map((l) => l.text).join("\n") ?? "";
    expect(joined).toContain("welcome home");
    expect(joined).toContain("Home");
    expect(joined).not.toContain("# Home"); // rendered, not raw source
    expect(r.pager?.title).toBe("~/README.md");
  });

  it("tree renders the hierarchy", () => {
    const r = runCommand(root, home, "tree");
    const t = text(r);
    expect(t).toContain("writings/");
    expect(t).toContain("webrtc.md");
    expect(t).toMatch(/[├└]──/);
  });
});

describe("runCommand — shell built-ins", () => {
  it("help lists commands", () => {
    const r = runCommand(root, home, "help");
    expect(text(r)).toMatch(/ls \[path\]/);
    expect(text(r)).toMatch(/whoami/);
    expect(text(r)).toMatch(/gui/);
  });

  // The table is padded text, so on a narrow screen a row wraps and its tail
  // would land in column 0, reading as a command of its own. wrapIndent is what
  // stops that — it has to agree with the padding or the hang lands mid-word.
  it("help rows hang at the column their description starts in", () => {
    const row = runCommand(root, home, "help").lines.find((l) => l.text.includes("who is this guy"));
    expect(row?.wrapIndent).toBe(row?.text.indexOf("who is this guy"));
  });

  it("help rows all hang at the same column", () => {
    const rows = runCommand(root, home, "help").lines.filter((l) => l.text.startsWith("  ") && !l.wide);
    expect(new Set(rows.map((l) => l.wrapIndent)).size).toBe(1);
  });

  it("help leaves prose unindented, having no alignment to preserve", () => {
    const prose = runCommand(root, home, "help").lines.find((l) => l.text.startsWith("bash-ish"));
    expect(prose?.wrapIndent).toBeUndefined();
  });

  it("aliases rows hang at their own description column", () => {
    const row = runCommand(root, home, "aliases").lines.find((l) => l.text.includes("cat ~/work.md"));
    expect(row?.wrapIndent).toBe(row?.text.indexOf("cat ~/work.md"));
  });
});

// The shell never asks how wide the terminal is; it says everything and flags
// what only a desktop has room for, and the stylesheet drops the rest. These
// assert the flags, since nothing else in this module can see a viewport.
describe("runCommand — help at two widths", () => {
  const helpLines = () => runCommand(root, home, "help").lines;

  /** Spelled out rather than imported, so the test fails if the table shrinks. */
  const TABLE_COMMANDS = [
    "whoami",
    "ls [path]",
    "cd [path]",
    "cat <file>",
    "less <file>",
    "tree [path]",
    "pwd",
    "contact-me",
    "aliases",
    "clear",
    "gui",
  ];

  it("marks the shortcut word list as desktop-only", () => {
    const list = helpLines().find((l) => l.text.includes("education · certs"));
    expect(list?.wide).toBe(true);
  });

  it("marks the blank line above a desktop-only block too", () => {
    const lines = helpLines();
    const tip = lines.findIndex((l) => l.text.startsWith("tip:"));
    expect(lines[tip - 1]).toMatchObject({ text: "", wide: true });
  });

  it("keeps the closing line at every width", () => {
    const closing = helpLines().find((l) => l.text.startsWith("...and maybe"));
    expect(closing?.wide).toBeUndefined();
  });

  // The guarantee that matters: a phone loses asides and hints, never a command.
  it("keeps every command row at every width", () => {
    const onPhone = helpLines()
      .filter((l) => !l.wide)
      .map((l) => l.text)
      .join("\n");
    const missing = TABLE_COMMANDS.filter((cmd) => !onPhone.includes(cmd));
    expect(missing).toEqual([]);
  });

  it("splits a row with an aside so only the aside is desktop-only", () => {
    const row = helpLines().find((l) => l.text.includes("change directory"));
    expect(row?.segments?.map((s) => Boolean(s.wide))).toEqual([false, true]);
  });

  it("keeps the aside out of the row that a phone reads", () => {
    const row = helpLines().find((l) => l.text.includes("change directory"));
    expect(row?.segments?.[0].text).not.toMatch(/cd ~/);
  });

  it("leaves a row without an aside as plain text, not segments", () => {
    const row = helpLines().find((l) => l.text.includes("who is this guy"));
    expect(row?.segments).toBeUndefined();
  });

  it("whoami prints the name from the content", () => {
    const r = runCommand(root, home, "whoami");
    expect(text(r)).toContain(IDENTITY.name);
  });

  it("whoami prints the headline from the content", () => {
    const r = runCommand(root, home, "whoami");
    expect(text(r)).toContain(IDENTITY.headline);
  });

  it("contact-me prints the email from the content", () => {
    const r = runCommand(root, home, "contact-me");
    expect(text(r)).toContain(IDENTITY.contact.email);
  });

  it("contact-me makes the email a mailto link", () => {
    const r = runCommand(root, home, "contact-me");
    const seg = r.lines.flatMap((l) => l.segments ?? []).find((s) => s.text === IDENTITY.contact.email);
    expect(seg?.href).toBe(`mailto:${IDENTITY.contact.email}`);
  });

  it("contact-me links linkedin and github over https", () => {
    const segs = runCommand(root, home, "contact-me").lines.flatMap((l) => l.segments ?? []);
    expect(segs.find((s) => s.text === IDENTITY.contact.linkedin)?.href).toBe(`https://${IDENTITY.contact.linkedin}`);
    expect(segs.find((s) => s.text === IDENTITY.contact.github)?.href).toBe(`https://${IDENTITY.contact.github}`);
  });

  it("contact-me leaves the location unlinked", () => {
    const segs = runCommand(root, home, "contact-me").lines.flatMap((l) => l.segments ?? []);
    expect(segs.find((s) => s.text === IDENTITY.contact.location)?.href).toBeUndefined();
  });

  it("contact-me prints every contact channel", () => {
    const r = runCommand(root, home, "contact-me");
    expect(text(r)).toContain(IDENTITY.contact.linkedin);
    expect(text(r)).toContain(IDENTITY.contact.github);
    expect(text(r)).toContain(IDENTITY.contact.location);
  });

  it("aliases lists friendly shortcuts", () => {
    const r = runCommand(root, home, "aliases");
    expect(text(r)).toMatch(/work/);
    expect(text(r)).toMatch(/cat ~\/work\.md/);
  });

  it("the aliases example points at a file that exists", () => {
    const example = /same as "cat (.+?)"/.exec(text(runCommand(root, home, "aliases")))?.[1];
    expect(example).toBeTruthy();
    expect(text(runCommand(root, home, `cat ${example}`))).not.toMatch(/no such file/);
  });

  it("clear signals a screen wipe", () => {
    const r = runCommand(root, home, "clear");
    expect(r.clear).toBe(true);
  });

  it("gui requests navigation to the classic page", () => {
    const r = runCommand(root, home, "gui");
    expect(r.navigate).toBe("/classic/");
  });

  it("echo echoes its args", () => {
    const r = runCommand(root, home, "echo hi there");
    expect(text(r)).toBe("hi there");
  });

  it("unknown commands report not found", () => {
    const r = runCommand(root, home, "frobnicate");
    expect(text(r)).toMatch(/command not found: frobnicate/);
  });

  it("empty input produces no output", () => {
    const r = runCommand(root, home, "   ");
    expect(r.lines).toHaveLength(0);
  });
});

describe("runCommand — aliases & easter eggs", () => {
  it("a bare alias cats its target file", () => {
    const r = runCommand(root, home, "work");
    expect(text(r)).toContain("Work");
  });

  it("aliases are case-insensitive", () => {
    const r = runCommand(root, home, "SKILLS");
    expect(text(r)).toContain("Skills");
  });

  it("sudo hire-me grants permission", () => {
    const r = runCommand(root, home, "sudo hire-me");
    expect(text(r)).toMatch(/permission granted/);
  });

  it("sudo hire-me hands out the email from the content", () => {
    const r = runCommand(root, home, "sudo hire-me");
    expect(text(r)).toContain(IDENTITY.contact.email);
  });

  it("sudo hire-me offers a mailto with a prefilled subject", () => {
    const seg = runCommand(root, home, "sudo hire-me")
      .lines.flatMap((l) => l.segments ?? [])
      .find((s) => s.text === IDENTITY.contact.email);
    expect(seg?.href).toMatch(new RegExp(`^mailto:${IDENTITY.contact.email}\\?subject=.+`));
  });
});

describe("complete", () => {
  it("completes a unique command", () => {
    const r = complete(root, HOME_PATH, "ca");
    expect(r.replacement).toBe("cat");
  });

  it("offers multiple command candidates on an ambiguous prefix", () => {
    const r = complete(root, HOME_PATH, "c");
    expect(r.completions).toEqual(expect.arrayContaining(["cat", "cd", "clear", "contact"]));
  });

  it("completes a directory path argument", () => {
    const r = complete(root, HOME_PATH, "cat wri");
    expect(r.replacement).toBe("cat writings/");
  });

  it("lists directory contents for a trailing slash", () => {
    const r = complete(root, HOME_PATH, "cat writings/");
    expect(r.completions).toEqual(expect.arrayContaining(["README.md", "webrtc.md"]));
  });

  it("returns nothing for an unmatched path", () => {
    const r = complete(root, HOME_PATH, "cat zzz");
    expect(r.completions).toHaveLength(0);
  });

  it("keeps the command word when the input ends in a space", () => {
    const r = complete(root, HOME_PATH, "cat ");
    expect(r.replacement?.startsWith("cat ")).toBe(true);
  });

  it("lists every candidate when the input ends in a space", () => {
    const r = complete(root, HOME_PATH, "cat ");
    expect(r.completions).toEqual(expect.arrayContaining(["README.md", "work.md", "writings/"]));
  });

  it("keeps earlier arguments when completing after a space", () => {
    const r = complete(root, HOME_PATH, "cat README.md ");
    expect(r.replacement?.startsWith("cat README.md ")).toBe(true);
  });
});

describe("runCommand — trailing slashes", () => {
  it("cat rejects a file addressed as a directory", () => {
    const r = runCommand(root, home, "cat README.md/");
    expect(text(r)).toMatch(/not a directory/);
  });

  it("ls rejects a file addressed as a directory", () => {
    const r = runCommand(root, home, "ls README.md/");
    expect(text(r)).toMatch(/not a directory/);
  });

  it("less rejects a file addressed as a directory", () => {
    const r = runCommand(root, home, "less README.md/");
    expect(r.pager).toBeUndefined();
    expect(text(r)).toMatch(/not a directory/);
  });

  it("still accepts a trailing slash on a real directory", () => {
    const r = runCommand(root, home, "ls writings/");
    expect(r.lines.map((l) => l.text)).toContain("webrtc.md");
  });
});

describe("parseInline", () => {
  it("marks bold runs", () => {
    const segs = parseInline("a **b** c");
    expect(segs).toContainEqual({ text: "b", color: "text", bold: true });
  });

  it("tints inline code green", () => {
    const segs = parseInline("run `cmd` now");
    expect(segs).toContainEqual({ text: "cmd", color: "green" });
  });

  it("colours links and shows their label", () => {
    const segs = parseInline("see [docs](https://x.dev)");
    expect(segs).toContainEqual({ text: "docs", color: "pink", href: "https://x.dev" });
  });

  it("keeps a markdown link's destination as an href", () => {
    const [link] = parseInline("[docs](https://x.dev)").filter((s) => s.href);
    expect(link.href).toBe("https://x.dev");
  });

  it("linkifies a bare email as mailto", () => {
    const segs = parseInline("write to ada@example.dev today");
    expect(segs).toContainEqual({ text: "ada@example.dev", color: "cyan", href: "mailto:ada@example.dev" });
  });

  it("linkifies a bare url", () => {
    const [link] = parseInline("see https://x.dev now").filter((s) => s.href);
    expect(link.href).toBe("https://x.dev");
  });

  it("gives a scheme-less www link an https href", () => {
    const [link] = parseInline("see www.x.dev now").filter((s) => s.href);
    expect(link.href).toBe("https://www.x.dev");
  });

  it("refuses a javascript: destination", () => {
    const segs = parseInline("[click](javascript:alert(1))");
    expect(segs.every((s) => s.href === undefined)).toBe(true);
  });

  it("refuses a data: destination", () => {
    const segs = parseInline("[click](data:text/html;base64,PHM+)");
    expect(segs.every((s) => s.href === undefined)).toBe(true);
  });

  it("leaves plain prose without any href", () => {
    expect(parseInline("just some words").every((s) => s.href === undefined)).toBe(true);
  });
});

describe("renderMarkdownLines", () => {
  it("colours headings cyan, strips the marker, and bolds them", () => {
    const [first] = renderMarkdownLines("# Title");
    expect(first.text).toBe("Title");
    expect(first.color).toBe("cyan");
    expect(first.segments?.every((s) => s.bold)).toBe(true);
  });

  it("renders bullets and strips emphasis in the plain text", () => {
    const lines = renderMarkdownLines("- **bold** item");
    expect(lines[0].text).toBe("  • bold item");
    // the bold run survives as a highlighted segment
    expect(lines[0].segments).toContainEqual({ text: "bold", color: "text", bold: true });
  });

  it("keeps indented blocks verbatim and green", () => {
    const lines = renderMarkdownLines("    code block");
    expect(lines[0]).toEqual({ text: "    code block", color: "green" });
  });
});
