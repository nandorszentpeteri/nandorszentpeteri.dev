/**
 * The shell. Pure command evaluation over the virtual filesystem: given the
 * current working directory and a line of input, produce output lines and any
 * side-effect signals (clear, navigate, open pager). No React, no DOM — which
 * is exactly why it's easy to unit-test.
 */

import type { Contact } from "./cv";
import { WRITINGS_ENABLED } from "./features";
import {
  VfsDir,
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

/** A run of text within a line that carries its own colour / weight. `href`
 *  turns the run into a real link — real terminals linkify URLs too. */
export type Segment = { text: string; color?: LineColor; bold?: boolean; href?: string };

/**
 * One rendered line. `text` is always the plain (marker-stripped) content, so
 * it's easy to assert on. `segments`, when present, drive syntax-highlighted
 * rendering (headings, bold, inline code, links).
 *
 * `wrapIndent` is the column a continuation should hang at when the line is too
 * wide for the screen — the only concession this module makes to the fact that
 * it might be read on a phone. A real terminal never needs it: the window is a
 * fixed number of columns and output is written to fit. Here the window is
 * whatever device is holding it, so a padded two-column row like
 * `  gui          open the classic page` runs out of room on a 360px screen and
 * drops "page" to column 0, where it reads as a command of its own. Setting
 * this to the column the description starts at makes the overflow line up under
 * the description instead, the way a man page does.
 *
 * Only lines whose alignment carries meaning need it. Prose is left alone —
 * hanging prose looks like a series of unrelated fragments.
 */
export type OutputLine = { text: string; color?: LineColor; segments?: Segment[]; wrapIndent?: number };

/**
 * Who the shell says it is. Parsed out of `content/*.md` and handed in, so
 * `whoami` and `contact-me` can't drift from the pages or the CV — and so no
 * address is hardcoded into the bundle behind the one contact.md publishes.
 */
export type Identity = { name: string; headline: string; contact: Contact };

export type ShellState = {
  cwd: string;
  identity: Identity;
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

const notFound = (cmd: string): OutputLine[] => [c(`command not found: ${cmd} — try "help"`, "pink")];

/**
 * A trailing slash asserts "this is a directory". A real shell errors on
 * `cat work.md/` rather than quietly reading the file, and so do we.
 */
const assertsDir = (target: string) => target.trim().endsWith("/");

const notADir = (cmd: string, target: string): OutputLine[] => [c(`${cmd}: ${target}: not a directory`, "pink")];

/** Two spaces of gutter in front of every table row, in both tables below. */
const TABLE_INDENT = "  ";

/**
 * Lay a name and a description out as a padded two-column row.
 *
 * Curried on the column width so `help` and `aliases` each fix their own, and
 * so the width is stated once per table rather than at every row. The returned
 * line carries the description's column as its `wrapIndent`, which is the whole
 * point of deriving the width instead of hardcoding it: rename the longest
 * command and the padding and the hanging indent move together.
 */
const tableRow =
  (width: number) =>
  (name: string, description: string, color: LineColor = "text"): OutputLine => ({
    text: `${TABLE_INDENT}${name.padEnd(width)}${description}`,
    color,
    wrapIndent: TABLE_INDENT.length + width,
  });

/** The widest name plus a two-space gutter — the column the descriptions start at. */
const columnFor = (names: string[]) => Math.max(...names.map((n) => n.length)) + 2;

/**
 * The command table, as data rather than pre-padded strings, so the column
 * width is computed from the contents.
 *
 * Descriptions are kept short deliberately. This table is the first thing most
 * visitors read, and the narrow phones still in use fit about 37 monospace
 * characters — so a row of 40 loses its last word to the next line. The asides
 * that used to trail these (`cd ..`, `q to quit`) live on a prose line below
 * for the same reason. `wrapIndent` catches whatever still overflows.
 */
const HELP_ROWS: [name: string, description: string, color?: LineColor][] = [
  ["whoami", "who is this guy"],
  ["ls [path]", "list a directory"],
  ["cd [path]", "change directory"],
  ["cat <file>", "print a file"],
  ["less <file>", "page through a file"],
  ["tree [path]", "show the tree"],
  ["pwd", "where am I"],
  ["contact-me", "how to reach me"],
  ["aliases", "list the shortcuts"],
  ["clear", "wipe the screen"],
  ["gui", "switch to classic", "cyan"],
];

const helpRow = tableRow(columnFor(HELP_ROWS.map(([name]) => name)));

const helpLines = (): OutputLine[] => [
  c("bash-ish. real commands, real filesystem. try these:", "dim"),
  c(""),
  ...HELP_ROWS.map(([name, description, color]) => helpRow(name, description, color)),
  c(""),
  // Short lines, one fact each, rather than a paragraph of hints. Prose has no
  // alignment for `wrapIndent` to preserve, so the only way it survives a narrow
  // screen is by being short enough not to need the screen's whole width.
  // `aliases` used to spell its own shortcuts out here too; it's a command in
  // the table above, and running it is a better introduction than a list that
  // wrapped into a line beginning with a separator.
  c("cd .. , cd ~ and cd - all work.", "faint"),
  c("Tab completes, ↑/↓ walk history.", "faint"),
  c("q quits the pager.", "faint"),
  c(""),
  c("...and maybe a hidden one or two.", "faint"),
];

const aliasRow = tableRow(columnFor(Object.keys(ALIASES)));

const aliasLines = (): OutputLine[] => [
  c("aliases — a friendly word that just opens a file:", "dim"),
  c(""),
  ...Object.entries(ALIASES).map(([name, target]) => aliasRow(name, `cat ${target}`, "cyan")),
  c(""),
  // Quoting ALIASES rather than a literal path: the example can't outlive a rename.
  c(`so typing "work" is the same as "cat ${ALIASES.work}".`, "faint"),
];

/**
 * Turn markdown into lightly-coloured terminal lines. We don't render real
 * markdown here — we keep it looking like a file being catted, just readable:
 * headings pop, quotes dim, inline `**` and backticks are stripped.
 */

/** Bold, inline code, `[label](url)` links, bare URLs and bare email addresses —
 *  the inline forms both the rendered and the source view care about. A fresh
 *  regex per call because `lastIndex` on a shared /g literal would leak between
 *  callers. */
const inlineRe = () =>
  /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]*\))|((?:https?:\/\/|www\.)[^\s)]+)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

const EMAIL_TOKEN = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;

/**
 * Only http(s) and mailto ever become real links. The markdown under `content/`
 * is trusted today, but a URL from a file is still data reaching an `href`, and
 * an allowlist costs nothing — `javascript:` and `data:` render as plain text.
 */
const SAFE_HREF = /^(?:https?:|mailto:)/i;

const linkSegment = (text: string, color: LineColor, url: string): Segment => {
  const candidate = /^www\./i.test(url) ? `https://${url}` : url.trim();
  return SAFE_HREF.test(candidate) ? { text, color, href: candidate } : { text, color };
};

/**
 * Walk the inline tokens of a line, leaving it to the caller to decide what each
 * token becomes. `parseInline` (rendered) and `highlightInlineSource` (raw
 * source) differ only in that decision, so this is the whole shared machinery.
 */
const tokenize =
  (toSegment: (token: string, base: LineColor) => Segment) =>
  (text: string, base: LineColor = "text"): Segment[] => {
    const segs: Segment[] = [];
    const re = inlineRe();
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ text: text.slice(last, m.index), color: base });
      segs.push(toSegment(m[0], base));
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ text: text.slice(last), color: base });
    if (segs.length === 0) segs.push({ text, color: base });
    return segs;
  };

/** Split inline markdown (**bold**, `code`, [links](url), bare URLs) into
 *  coloured segments over a base colour, dropping the markers. */
export const parseInline = tokenize((tok, base) => {
  if (tok.startsWith("**")) return { text: tok.slice(2, -2), color: base, bold: true };
  if (tok.startsWith("`")) return { text: tok.slice(1, -1), color: "green" };
  if (tok.startsWith("[")) {
    const md = /\[([^\]]+)\]\(([^)]*)\)/.exec(tok);
    return linkSegment(md?.[1] ?? tok, "pink", md?.[2] ?? "");
  }
  if (EMAIL_TOKEN.test(tok)) return { text: tok, color: "cyan", href: `mailto:${tok}` };
  return linkSegment(tok, "cyan", tok);
});

/** Inline highlighter that PRESERVES the markdown markers (source view). */
const highlightInlineSource = tokenize((tok, base) => {
  if (tok.startsWith("**")) return { text: tok, color: base, bold: true };
  if (tok.startsWith("`")) return { text: tok, color: "green" };
  // markers stay visible, but the whole token still carries the destination
  if (tok.startsWith("[")) return linkSegment(tok, "cyan", /\]\(([^)]*)\)/.exec(tok)?.[1] ?? "");
  if (EMAIL_TOKEN.test(tok)) return { text: tok, color: "cyan", href: `mailto:${tok}` };
  return linkSegment(tok, "cyan", tok);
});

const joinSegs = (segs: Segment[]) => segs.map((s) => s.text).join("");

/**
 * Syntax-highlight markdown into terminal lines. Not a full markdown renderer —
 * it keeps a "file being catted" feel while colouring headings, bold, inline
 * code, links, quotes, bullets and indented blocks. Shared by `cat` and `less`.
 */
export const renderMarkdownLines = (content: string): OutputLine[] =>
  content
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

/**
 * `cat` view: terminal-like syntax highlighting of the *raw* markdown source.
 * Markers (`#`, `**`, `` ` ``, `-`) stay visible and get coloured, the way
 * `bat` or an editor shows a file — no rendering. The fully rendered view is
 * `less`'s job (see `renderMarkdownLines`).
 */
export const highlightMarkdownSource = (content: string): OutputLine[] =>
  content
    .replace(/\n+$/, "")
    .split("\n")
    .map((raw): OutputLine => {
      const line = raw.replace(/\r$/, "");
      if (/^( {4}|\t)/.test(line)) return { text: line, color: "green" };
      if (/^#{1,6}\s/.test(line)) {
        return {
          text: line,
          color: "cyan",
          segments: highlightInlineSource(line, "cyan").map((s) => ({ ...s, bold: true })),
        };
      }
      if (/^>\s?/.test(line)) return { text: line, color: "dim", segments: highlightInlineSource(line, "dim") };
      const bullet = /^(\s*[-*]\s+)(.*)$/.exec(line);
      if (bullet) {
        return {
          text: line,
          color: "text",
          segments: [{ text: bullet[1], color: "purple" }, ...highlightInlineSource(bullet[2], "text")],
        };
      }
      if (line.trim() === "") return { text: "", color: "text" };
      return { text: line, color: "text", segments: highlightInlineSource(line, "text") };
    });

const cmdLs = (root: VfsDir, cwd: string, args: string[]): OutputLine[] => {
  const target = args[0] ?? ".";
  const node = getNode(root, resolvePath(cwd, target));
  if (!node) return [c(`ls: ${target}: no such file or directory`, "pink")];
  if (isFile(node)) return assertsDir(target) ? notADir("ls", target) : [c(node.name, "text")];
  const { dirs, files } = listChildren(node);
  if (dirs.length === 0 && files.length === 0) return [c("(empty)", "faint")];
  return [...dirs.map((d) => c(d + "/", "cyan")), ...files.map((f) => c(f, "text"))];
};

const cmdCd = (root: VfsDir, state: ShellState, args: string[]): { cwd: string; lines: OutputLine[] } => {
  const target = args[0] ?? "~";
  const abs = resolvePath(state.cwd, target);
  const node = getNode(root, abs);
  if (!node) return { cwd: state.cwd, lines: [c(`cd: ${target}: no such file or directory`, "pink")] };
  if (isFile(node)) return { cwd: state.cwd, lines: notADir("cd", target) };
  return { cwd: abs, lines: [] };
};

const catFile = (root: VfsDir, cwd: string, target: string): OutputLine[] => {
  const node = getNode(root, resolvePath(cwd, target));
  if (!node) return [c(`cat: ${target}: no such file or directory`, "pink")];
  if (isDir(node)) return [c(`cat: ${target}: is a directory`, "pink")];
  if (assertsDir(target)) return notADir("cat", target);
  return highlightMarkdownSource(node.content);
};

const cmdTree = (root: VfsDir, cwd: string, args: string[]): OutputLine[] => {
  const target = args[0] ?? ".";
  const abs = resolvePath(cwd, target);
  const node = getNode(root, abs);
  if (!node) return [c(`tree: ${target}: no such file or directory`, "pink")];
  if (isFile(node)) return assertsDir(target) ? notADir("tree", target) : [c(node.name, "text")];

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
};

/** A `label   value` row where the value can be clicked. The hrefs are built the
 *  same way ContactBlock builds them, so both views point at the same places. */
const contactRow = (label: string, value: string, color: LineColor, url?: string): OutputLine => {
  const segments: Segment[] = [
    { text: label.padEnd(11), color },
    url ? linkSegment(value, color, url) : { text: value, color },
  ];
  return { text: joinSegs(segments), color, segments };
};

const contactLines = ({ contact }: Identity): OutputLine[] => [
  contactRow("email", contact.email, "cyan", `mailto:${contact.email}`),
  contactRow("linkedin", contact.linkedin, "pink", `https://${contact.linkedin}`),
  contactRow("github", contact.github, "purple", `https://${contact.github}`),
  contactRow("location", contact.location, "dim"),
  c("open to interesting conversations — say hi.", "faint"),
];

/** Prefilled so the click lands in a composed draft rather than a blank one. */
const HIRE_SUBJECT = "Interested in working together";

const hireLines = ({ contact }: Identity): OutputLine[] => {
  const arrow: Segment = { text: "→ ", color: "cyan" };
  const link = linkSegment(
    contact.email,
    "cyan",
    `mailto:${contact.email}?subject=${encodeURIComponent(HIRE_SUBJECT)}`,
  );
  return [
    c("[sudo] password for recruiter: ********", "dim"),
    c("permission granted.", "green"),
    { text: joinSegs([arrow, link]), color: "cyan", segments: [arrow, link] },
  ];
};

/**
 * Evaluate one line of input. `prevCwd` is used to support `cd -`.
 */
export const runCommand = (
  root: VfsDir,
  state: ShellState,
  input: string,
  prevCwd?: string,
): CommandResult => {
  const raw = input.trim();
  const base: CommandResult = { lines: [], cwd: state.cwd };
  if (raw === "") return base;

  const lower = raw.toLowerCase();
  const { identity } = state;

  // Whole-line special cases first.
  if (GUI_WORDS.has(lower)) {
    return { ...base, lines: [c("launching classic view…", "cyan")], navigate: "/classic/" };
  }
  if (lower === "sudo hire-me" || lower === "hire-me" || lower === "sudo hire me") {
    return { ...base, lines: hireLines(identity) };
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
          c(identity.name, "cyan"),
          c(identity.headline),
          c("Full-stack, 13+ years: gaming, fitness, streaming, smart home.", "dim"),
          c("Every layer of the stack — React/Next.js front-ends to", "dim"),
          c("microservices and CI/CD. Currently deep in agentic AI.", "dim"),
          c('type "about" for the longer version, or "work" for the history.', "faint"),
        ],
      };
    case "contact-me":
    case "contactme":
      return { ...base, lines: contactLines(identity) };
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
      return { ...base, lines: args.flatMap((a) => catFile(root, state.cwd, a)) };
    }
    case "less":
    case "more": {
      if (args.length === 0) return { ...base, lines: [c(`usage: ${cmd} <file>`, "faint")] };
      const abs = resolvePath(state.cwd, args[0]);
      const node = getNode(root, abs);
      if (!node) return { ...base, lines: [c(`${cmd}: ${args[0]}: no such file or directory`, "pink")] };
      if (isDir(node)) return { ...base, lines: [c(`${cmd}: ${args[0]}: is a directory`, "pink")] };
      if (assertsDir(args[0])) return { ...base, lines: notADir(cmd, args[0]) };
      return {
        ...base,
        pager: { title: displayPath(abs), lines: renderMarkdownLines(node.content) },
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
};

const commonPrefix = (strings: string[]): string =>
  strings.reduce((prefix, s) => {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    return prefix.slice(0, i);
  }, strings[0] ?? "");

const fill = (matches: string[]): string | undefined => (matches.length === 0 ? undefined : commonPrefix(matches));

/**
 * Tab-completion. Completes the command word at position 0, or a path for the
 * argument of a filesystem command. Returns candidate completions and, when
 * there's a common prefix to fill, the text the input should become.
 */
export const complete = (
  root: VfsDir,
  cwd: string,
  input: string,
): { completions: string[]; replacement?: string } => {
  const endsWithSpace = /\s$/.test(input);
  const tokens = input.split(/\s+/).filter(Boolean);

  // Completing the command word.
  if (tokens.length === 0 || (tokens.length === 1 && !endsWithSpace)) {
    const prefix = tokens[0]?.toLowerCase() ?? "";
    const pool = [...COMMANDS, ...Object.keys(ALIASES)];
    const matches = Array.from(new Set(pool.filter((cmd) => cmd.startsWith(prefix)))).sort();
    return { completions: matches, replacement: fill(matches) };
  }

  // Completing a path argument.
  const partial = endsWithSpace ? "" : tokens[tokens.length - 1];
  const slash = partial.lastIndexOf("/");
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const namePart = slash >= 0 ? partial.slice(slash + 1) : partial;

  const dirNode = getNode(root, resolvePath(cwd, dirPart || "."));
  if (!isDir(dirNode)) return { completions: [] };

  const { dirs, files } = listChildren(dirNode);
  const names = [...dirs.map((n) => n + "/"), ...files];
  const matches = names.filter((n) => n.toLowerCase().startsWith(namePart.toLowerCase()));
  if (matches.length === 0) return { completions: [] };

  // A trailing space means every token is already complete — dropping the last
  // one here would swallow the command word and blank the line.
  const head = (endsWithSpace ? tokens : tokens.slice(0, -1)).join(" ");
  return { completions: matches, replacement: `${head} ${dirPart}${commonPrefix(matches)}` };
};

export { HOME_PATH };
