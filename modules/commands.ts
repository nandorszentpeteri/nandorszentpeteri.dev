/**
 * The shell. Pure command evaluation over the virtual filesystem: given the
 * current working directory and a line of input, produce output lines and any
 * side-effect signals (clear, navigate, open pager). No React, no DOM — which
 * is exactly why it's easy to unit-test.
 */

import { WRITINGS_ENABLED } from "./features";
import {
  VfsDir,
  VfsNode,
  getNode,
  isDir,
  isFile,
  listChildren,
  resolvePath,
  displayPath,
  HOME_PATH,
} from "./vfs";

/** Owned by the palette (the names index `LINE_COLORS`); re-exported so line
 *  and segment consumers need only one import. */
import type { LineColor } from "@/theme/palette";
export type { LineColor };

/** A run of text within a line that carries its own colour / weight. */
export type Segment = { text: string; color?: LineColor; bold?: boolean };

/**
 * One rendered line. `text` is always the plain (marker-stripped) content, so
 * it's easy to assert on. `segments`, when present, drive syntax-highlighted
 * rendering (headings, bold, inline code, links).
 */
export type OutputLine = { text: string; color?: LineColor; segments?: Segment[] };

export type ShellState = {
  cwd: string;
};

export type CommandResult = {
  lines: OutputLine[];
  cwd: string;
  clear?: boolean;
  navigate?: string;
  pager?: { title: string; lines: OutputLine[] };
};

/**
 * Friendly aliases for people who'd rather not think in file paths. Each maps a
 * single word to a file the terminal will `cat`. Listed by the `aliases` command.
 */
const WRITING_ALIASES: Record<string, string> = {
  writings: "~/writings/README.md",
  writing: "~/writings/README.md",
  blog: "~/writings/README.md",
};

export const ALIASES: Record<string, string> = {
  about: "~/README.md",
  work: "~/work.md",
  experience: "~/work.md",
  skills: "~/skills.md",
  education: "~/education.md",
  certifications: "~/certifications.md",
  certs: "~/certifications.md",
  languages: "~/languages.md",
  ...(WRITINGS_ENABLED ? WRITING_ALIASES : {}),
  interests: "~/interests.md",
  contact: "~/contact.md",
};

/** Words that jump to the classic (no-terminal) page. */
export const GUI_WORDS = new Set(["gui", "classic", "cv"]);

/** Every real (non-alias) command, for help + tab completion. */
export const COMMANDS = [
  "help",
  "whoami",
  "ls",
  "cd",
  "cat",
  "less",
  "more",
  "pwd",
  "tree",
  "echo",
  "aliases",
  "alias",
  "contact-me",
  "clear",
  "gui",
] as const;

const c = (text: string, color?: LineColor): OutputLine => ({ text, color });

function notFound(cmd: string): OutputLine[] {
  return [c(`command not found: ${cmd} — try "help"`, "pink")];
}

const shortcutWords = [
  "about",
  "work",
  "skills",
  "education",
  "certs",
  ...(WRITINGS_ENABLED ? ["writings"] : []),
  "interests",
  "contact",
];

function helpLines(): OutputLine[] {
  return [
    c("bash-ish. real commands, real filesystem. try these:", "dim"),
    c(""),
    c("  whoami           who is this guy", "text"),
    c("  ls [path]        list a directory", "text"),
    c("  cd [path]        change directory  (cd .. , cd ~ , cd -)", "text"),
    c("  cat <file>       print a file", "text"),
    c("  less <file>      page through a file  (q to quit)", "text"),
    c("  tree [path]      show the tree", "text"),
    c("  pwd              where am I", "text"),
    c("  contact-me       how to reach me", "text"),
    c("  aliases          list the friendly shortcuts", "text"),
    c("  clear            wipe the screen", "text"),
    c("  gui              open the classic (no-terminal) page", "cyan"),
    c(""),
    c("shortcuts for the impatient (see `aliases`):", "dim"),
    c(`  ${shortcutWords.join(" · ")}`, "faint"),
    c(""),
    c("tip: Tab completes, ↑/↓ walk history. ...and maybe a hidden one or two.", "faint"),
  ];
}

function aliasLines(): OutputLine[] {
  const seen = new Set<string>();
  const lines: OutputLine[] = [
    c("aliases — a friendly word that just opens a file:", "dim"),
    c(""),
  ];
  for (const [name, target] of Object.entries(ALIASES)) {
    // Skip duplicate targets' noise a little, but still show each alias.
    const key = name;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(c(`  ${name.padEnd(12)} cat ${target}`, "cyan"));
  }
  lines.push(c(""));
  lines.push(c('so typing "work" is the same as "cat ~/work/README.md".', "faint"));
  return lines;
}

/**
 * Turn markdown into lightly-coloured terminal lines. We don't render real
 * markdown here — we keep it looking like a file being catted, just readable:
 * headings pop, quotes dim, inline `**` and backticks are stripped.
 */
/** Split inline markdown (**bold**, `code`, [links](url), bare URLs) into
 *  coloured segments over a base colour. */
export function parseInline(text: string, base: LineColor = "text"): Segment[] {
  const segs: Segment[] = [];
  const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]*\))|((?:https?:\/\/|www\.)[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), color: base });
    const tok = m[0];
    if (tok.startsWith("**")) {
      segs.push({ text: tok.slice(2, -2), color: base, bold: true });
    } else if (tok.startsWith("`")) {
      segs.push({ text: tok.slice(1, -1), color: "green" });
    } else if (tok.startsWith("[")) {
      const lm = /\[([^\]]+)\]\(([^)]*)\)/.exec(tok);
      segs.push({ text: lm ? lm[1] : tok, color: "pink" });
    } else {
      segs.push({ text: tok, color: "cyan" });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), color: base });
  if (segs.length === 0) segs.push({ text, color: base });
  return segs;
}

const joinSegs = (segs: Segment[]) => segs.map((s) => s.text).join("");

/**
 * Syntax-highlight markdown into terminal lines. Not a full markdown renderer —
 * it keeps a "file being catted" feel while colouring headings, bold, inline
 * code, links, quotes, bullets and indented blocks. Shared by `cat` and `less`.
 */
export function renderMarkdownLines(content: string): OutputLine[] {
  return content
    .replace(/\n+$/, "")
    .split("\n")
    .map((raw): OutputLine => {
      const line = raw.replace(/\r$/, "");

      // indented / preformatted block — keep verbatim, tint green
      if (/^( {4}|\t)/.test(line)) return { text: line.replace(/^\t/, "    "), color: "green" };

      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const segs = parseInline(heading[2], "cyan").map((s) => ({ ...s, bold: true }));
        return { text: joinSegs(segs), color: "cyan", segments: segs };
      }

      const quote = /^>\s?(.*)$/.exec(line);
      if (quote) {
        const segs = parseInline(quote[1], "dim");
        return { text: joinSegs(segs), color: "dim", segments: segs };
      }

      const bullet = /^[-*]\s+(.*)$/.exec(line);
      if (bullet) {
        const segs: Segment[] = [{ text: "  • ", color: "purple" }, ...parseInline(bullet[1], "text")];
        return { text: joinSegs(segs), color: "text", segments: segs };
      }

      const ordered = /^(\d+)\.\s+(.*)$/.exec(line);
      if (ordered) {
        const segs: Segment[] = [{ text: `  ${ordered[1]}. `, color: "purple" }, ...parseInline(ordered[2], "text")];
        return { text: joinSegs(segs), color: "text", segments: segs };
      }

      if (line.trim() === "") return { text: "", color: "text" };

      const segs = parseInline(line, "text");
      return { text: joinSegs(segs), color: "text", segments: segs };
    });
}

function cmdLs(root: VfsDir, cwd: string, args: string[]): OutputLine[] {
  const target = args[0] ?? ".";
  const abs = resolvePath(cwd, target);
  const node = getNode(root, abs);
  if (!node) return [c(`ls: ${target}: no such file or directory`, "pink")];
  if (isFile(node)) return [c(node.name, "text")];
  const { dirs, files } = listChildren(node);
  if (dirs.length === 0 && files.length === 0) return [c("(empty)", "faint")];
  const out: OutputLine[] = [];
  for (const d of dirs) out.push(c(d + "/", "cyan"));
  for (const f of files) out.push(c(f, "text"));
  return out;
}

function cmdCd(
  root: VfsDir,
  state: ShellState,
  args: string[],
): { cwd: string; lines: OutputLine[] } {
  const target = args[0] ?? "~";
  const abs = resolvePath(state.cwd, target);
  const node = getNode(root, abs);
  if (!node) return { cwd: state.cwd, lines: [c(`cd: ${target}: no such file or directory`, "pink")] };
  if (isFile(node)) return { cwd: state.cwd, lines: [c(`cd: ${target}: not a directory`, "pink")] };
  return { cwd: abs, lines: [] };
}

/** Inline highlighter that PRESERVES the markdown markers (source view). */
function highlightInlineSource(text: string, base: LineColor): Segment[] {
  const segs: Segment[] = [];
  const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]*\))|((?:https?:\/\/|www\.)[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), color: base });
    const tok = m[0];
    if (tok.startsWith("**")) segs.push({ text: tok, color: base, bold: true });
    else if (tok.startsWith("`")) segs.push({ text: tok, color: "green" });
    else segs.push({ text: tok, color: "cyan" }); // links + bare urls
    last = m.index + tok.length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), color: base });
  if (segs.length === 0) segs.push({ text, color: base });
  return segs;
}

/**
 * `cat` view: terminal-like syntax highlighting of the *raw* markdown source.
 * Markers (`#`, `**`, `` ` ``, `-`) stay visible and get coloured, the way
 * `bat` or an editor shows a file — no rendering. The fully rendered view is
 * `less`'s job (see `renderMarkdownLines`).
 */
export function highlightMarkdownSource(content: string): OutputLine[] {
  return content
    .replace(/\n+$/, "")
    .split("\n")
    .map((raw): OutputLine => {
      const line = raw.replace(/\r$/, "");
      if (/^( {4}|\t)/.test(line)) return { text: line, color: "green" };
      if (/^#{1,6}\s/.test(line)) {
        return { text: line, color: "cyan", segments: highlightInlineSource(line, "cyan").map((s) => ({ ...s, bold: true })) };
      }
      if (/^>\s?/.test(line)) return { text: line, color: "dim", segments: highlightInlineSource(line, "dim") };
      const bullet = /^(\s*[-*]\s+)(.*)$/.exec(line);
      if (bullet) {
        return { text: line, color: "text", segments: [{ text: bullet[1], color: "purple" }, ...highlightInlineSource(bullet[2], "text")] };
      }
      if (line.trim() === "") return { text: "", color: "text" };
      return { text: line, color: "text", segments: highlightInlineSource(line, "text") };
    });
}

function catFile(root: VfsDir, cwd: string, target: string): OutputLine[] {
  const abs = resolvePath(cwd, target);
  const node = getNode(root, abs);
  if (!node) return [c(`cat: ${target}: no such file or directory`, "pink")];
  if (isDir(node)) return [c(`cat: ${target}: is a directory`, "pink")];
  return highlightMarkdownSource((node as Extract<VfsNode, { type: "file" }>).content);
}

function cmdTree(root: VfsDir, cwd: string, args: string[]): OutputLine[] {
  const target = args[0] ?? ".";
  const abs = resolvePath(cwd, target);
  const node = getNode(root, abs);
  if (!node) return [c(`tree: ${target}: no such file or directory`, "pink")];
  if (isFile(node)) return [c(node.name, "text")];

  const out: OutputLine[] = [c(displayPath(abs), "cyan")];
  const walk = (dir: VfsDir, prefix: string) => {
    const { dirs, files } = listChildren(dir);
    const entries = [...dirs.map((n) => [n, true] as const), ...files.map((n) => [n, false] as const)];
    entries.forEach(([name, isD], i) => {
      const last = i === entries.length - 1;
      const branch = last ? "└── " : "├── ";
      out.push(c(prefix + branch + name + (isD ? "/" : ""), isD ? "cyan" : "text"));
      if (isD) walk(dir.children[name] as VfsDir, prefix + (last ? "    " : "│   "));
    });
  };
  walk(node, "");
  return out;
}

/**
 * Evaluate one line of input. `prevCwd` is used to support `cd -`.
 */
export function runCommand(
  root: VfsDir,
  state: ShellState,
  input: string,
  prevCwd?: string,
): CommandResult {
  const raw = input.trim();
  const base: CommandResult = { lines: [], cwd: state.cwd };
  if (raw === "") return base;

  const lower = raw.toLowerCase();

  // Whole-line special cases first.
  if (GUI_WORDS.has(lower)) {
    return { ...base, lines: [c("launching classic view…", "cyan")], navigate: "/classic/" };
  }
  if (lower === "sudo hire-me" || lower === "hire-me" || lower === "sudo hire me") {
    return {
      ...base,
      lines: [
        c("[sudo] password for recruiter: ********", "dim"),
        c("permission granted.", "green"),
        c("→ hello@nandorszentpeteri.dev", "cyan"),
      ],
    };
  }
  if (lower === "vaporwave" || lower === "aesthetic") {
    return {
      ...base,
      lines: [
        c("░▒▓█ a e s t h e t i c   m o d e █▓▒░", "pink"),
        c("already running at maximum. this is the professional setting.", "dim"),
      ],
    };
  }

  const tokens = raw.split(/\s+/);
  const cmd = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  // Friendly aliases: only when used bare (e.g. `work`, not `work foo`).
  if (ALIASES[cmd] && args.length === 0) {
    return { ...base, lines: catFile(root, state.cwd, ALIASES[cmd]) };
  }

  switch (cmd) {
    case "help":
    case "?":
      return { ...base, lines: helpLines() };
    case "whoami":
      return {
        ...base,
        lines: [
          c("Nandor Szentpeteri", "cyan"),
          c("Senior Software Engineer @ Roku · Leeds, UK"),
          c("Full-stack, 13+ years: gaming, fitness, streaming, smart home.", "dim"),
          c("Every layer of the stack — React/Next.js front-ends to", "dim"),
          c("microservices and CI/CD. Currently deep in agentic AI.", "dim"),
          c('type "about" for the longer version, or "work" for the history.', "faint"),
        ],
      };
    case "contact-me":
    case "contactme":
      return {
        ...base,
        lines: [
          c("email      hello@nandorszentpeteri.dev", "cyan"),
          c("linkedin   linkedin.com/in/nandorszentpeteri", "pink"),
          c("location   Leeds, UK", "dim"),
          c("open to interesting conversations — say hi.", "faint"),
        ],
      };
    case "aliases":
    case "alias":
      return { ...base, lines: aliasLines() };
    case "clear":
      return { ...base, clear: true };
    case "pwd":
      return { ...base, lines: [c(state.cwd)] };
    case "ls":
    case "ll":
    case "dir":
      return { ...base, lines: cmdLs(root, state.cwd, args) };
    case "cd": {
      if (args[0] === "-") {
        const dest = prevCwd ?? state.cwd;
        const node = getNode(root, dest);
        if (isDir(node)) return { ...base, cwd: dest, lines: [c(displayPath(dest), "faint")] };
        return { ...base, lines: [c("cd: OLDPWD not set", "pink")] };
      }
      const res = cmdCd(root, state, args);
      return { ...base, cwd: res.cwd, lines: res.lines };
    }
    case "cat": {
      if (args.length === 0) return { ...base, lines: [c("usage: cat <file>", "faint")] };
      const lines: OutputLine[] = [];
      for (const a of args) lines.push(...catFile(root, state.cwd, a));
      return { ...base, lines };
    }
    case "less":
    case "more": {
      if (args.length === 0) return { ...base, lines: [c(`usage: ${cmd} <file>`, "faint")] };
      const abs = resolvePath(state.cwd, args[0]);
      const node = getNode(root, abs);
      if (!node) return { ...base, lines: [c(`${cmd}: ${args[0]}: no such file or directory`, "pink")] };
      if (isDir(node)) return { ...base, lines: [c(`${cmd}: ${args[0]}: is a directory`, "pink")] };
      return {
        ...base,
        pager: {
          title: displayPath(abs),
          lines: renderMarkdownLines((node as Extract<VfsNode, { type: "file" }>).content),
        },
      };
    }
    case "tree":
      return { ...base, lines: cmdTree(root, state.cwd, args) };
    case "echo":
      return { ...base, lines: [c(args.join(" "))] };
    case "exit":
    case "quit":
      return { ...base, lines: [c('nice try. type "gui" for the classic page instead.', "dim")] };
    case "sudo":
      return { ...base, lines: [c(`${tokens[1] ?? "that"}: permission granted, obviously. you're hired-ish.`, "dim")] };
    default:
      return { ...base, lines: notFound(cmd) };
  }
}

/**
 * Tab-completion. Completes the command word at position 0, or a path for the
 * argument of a filesystem command. Returns candidate completions and, when
 * there's a common prefix to fill, the text the input should become.
 */
export function complete(root: VfsDir, cwd: string, input: string): { completions: string[]; replacement?: string } {
  const endsWithSpace = /\s$/.test(input);
  const tokens = input.split(/\s+/).filter(Boolean);

  // Completing the command word.
  if (tokens.length === 0 || (tokens.length === 1 && !endsWithSpace)) {
    const prefix = tokens[0]?.toLowerCase() ?? "";
    const pool = [...COMMANDS, ...Object.keys(ALIASES)];
    const matches = Array.from(new Set(pool.filter((cmd) => cmd.startsWith(prefix)))).sort();
    return { completions: matches, replacement: fill(prefix, matches) };
  }

  // Completing a path argument.
  const partial = endsWithSpace ? "" : tokens[tokens.length - 1];
  const slash = partial.lastIndexOf("/");
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const namePart = slash >= 0 ? partial.slice(slash + 1) : partial;

  const dirAbs = resolvePath(cwd, dirPart || ".");
  const dirNode = getNode(root, dirAbs);
  if (!isDir(dirNode)) return { completions: [] };

  const { dirs, files } = listChildren(dirNode);
  const names = [...dirs.map((n) => n + "/"), ...files];
  const matches = names.filter((n) => n.toLowerCase().startsWith(namePart.toLowerCase()));
  if (matches.length === 0) return { completions: [] };

  const commonName = commonPrefix(matches);
  const head = tokens.slice(0, -1).join(" ");
  const replacement = `${head} ${dirPart}${commonName}`;
  return { completions: matches, replacement };
}

function fill(prefix: string, matches: string[]): string | undefined {
  if (matches.length === 0) return undefined;
  return commonPrefix(matches);
}

function commonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix === "") break;
  }
  return prefix;
}

export { HOME_PATH };
