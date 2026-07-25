/**
 * Parses the same `content/*.md` files the terminal serves into structured data
 * for the classic page's designed layout. This keeps a single source of truth:
 * edit the markdown and both views update.
 *
 * The convention is lightweight and stays readable as plain markdown:
 *  - work.md:   `## Title` + a date line + prose paragraph(s); **bold** names
 *               are highlighted on the classic page
 *  - skills.md: `## group/` + an items line
 *  - writings:  `# Title` + a `` `TAG · drafting` `` line + a blurb paragraph
 *  - contact.md: `- **key** — value` bullets (email / linkedin / location)
 *  - README.md: a line of only `` `code` `` tokens = the skill badges
 */

import type { ContentEntry } from "./vfs";

export type Role = { title: string; date: string; body: string[] };
export type SkillGroup = { label: string; items: string };
export type Post = { title: string; tag: string; blurb: string };
export type Contact = {
  email: string;
  linkedin: string;
  github: string;
  location: string;
  /** The closing prose line of contact.md, shown as the tagline on both views. */
  tagline: string;
};
/** A certification, with the issuer's public verification URL when there is one. */
export type Cert = { text: string; url?: string };

export type CvData = {
  bio: string[];
  badges: string[];
  roles: Role[];
  skillGroups: SkillGroup[];
  posts: Post[];
  degrees: string[];
  certs: Cert[];
  languages: string[];
  interests: string;
  contact: Contact;
};

/** Turn `[text](url)` into just `text`. */
const stripLinks = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

const stripInline = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

const unwrap = (block: string) => block.replace(/\s*\n\s*/g, " ").trim();

const blocks = (content: string): string[] =>
  content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

function parseReadme(content: string): { bio: string[]; badges: string[] } {
  const bio: string[] = [];
  let badges: string[] = [];
  for (const block of blocks(content)) {
    if (block.startsWith("#")) continue; // name heading
    if (/^\*\*.*\*\*$/.test(block)) continue; // headline
    const codes = [...block.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // a line made up only of `code` tokens (and separators) is the badge row
    if (codes.length >= 2 && block.replace(/`[^`]+`/g, "").replace(/[·•\s]/g, "") === "") {
      badges = codes;
      continue;
    }
    bio.push(unwrap(block));
  }
  return { bio, badges };
}

function parseWork(content: string): Role[] {
  const roles: Role[] = [];
  let cur: Role | null = null;
  let para = "";
  const flush = () => {
    if (cur && para.trim()) cur.body.push(para.trim());
    para = "";
  };
  for (const raw of content.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const h2 = /^##\s+(.+)/.exec(line);
    if (h2) {
      flush();
      if (cur) roles.push(cur);
      cur = { title: h2[1].trim(), date: "", body: [] };
      continue;
    }
    if (!cur) continue;
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (line.startsWith("#")) continue;
    // first non-empty line after the title is the date; the rest is prose
    if (!cur.date) {
      cur.date = line.trim();
      continue;
    }
    para = para ? `${para} ${line.trim()}` : line.trim();
  }
  flush();
  if (cur) roles.push(cur);
  return roles;
}

function parseContact(content: string): Contact {
  const map: Record<string, string> = {};
  const prose: string[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = /^-\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+)/.exec(line);
    if (m) {
      map[m[1].trim().toLowerCase()] = stripLinks(m[2].trim());
      continue;
    }
    // anything that isn't a heading or a bullet is the closing tagline
    if (line.trim() && !line.startsWith("#")) prose.push(stripInline(line.trim()));
  }
  return {
    email: map.email ?? "",
    linkedin: map.linkedin ?? "",
    github: map.github ?? "",
    location: map.location ?? "",
    tagline: prose.join(" "),
  };
}

function parseSkills(content: string): SkillGroup[] {
  const groups: SkillGroup[] = [];
  let cur: SkillGroup | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const h2 = /^##\s+(.+)/.exec(line);
    if (h2) {
      if (cur) groups.push(cur);
      cur = { label: h2[1].trim(), items: "" };
      continue;
    }
    if (cur && line.trim() && !line.startsWith("#")) {
      cur.items = cur.items ? `${cur.items} ${line.trim()}` : line.trim();
    }
  }
  if (cur) groups.push(cur);
  return groups;
}

function parsePost(content: string): Post {
  const title = (/^#\s+(.+)/m.exec(content)?.[1] ?? "").trim();
  let tag = "";
  let blurb = "";
  for (const block of blocks(content)) {
    if (block.startsWith("#")) continue;
    const t = /^`([^`]+)`$/.exec(block);
    if (t && !tag) {
      tag = t[1].trim();
      continue;
    }
    if (!blurb && !block.startsWith("-") && !block.startsWith("`")) blurb = unwrap(block);
  }
  return { title, tag, blurb };
}

/** A trailing `· [label](url)` on a cert bullet is the issuer's verification link. */
const CERT_LINK = /\s*[·•]\s*\[[^\]]+\]\(([^)]+)\)\s*$/;

const parseCert = (bullet: string): Cert => {
  const link = CERT_LINK.exec(bullet);
  return link
    ? { text: stripInline(bullet.slice(0, link.index)), url: link[1] }
    : { text: stripInline(bullet) };
};

function parseCerts(content: string): Cert[] {
  const certs: Cert[] = [];
  for (const raw of content.split("\n")) {
    const bullet = /^-\s+(.+)/.exec(raw.replace(/\r$/, ""));
    if (bullet) certs.push(parseCert(bullet[1]));
  }
  return certs;
}

function parseList(content: string): string[] {
  const out: string[] = [];
  for (const raw of content.split("\n")) {
    const b = /^-\s+(.+)/.exec(raw);
    if (b) out.push(stripInline(b[1]));
  }
  return out;
}

function parseParagraph(content: string): string {
  for (const block of blocks(content)) {
    if (block.startsWith("#")) continue;
    return unwrap(block);
  }
  return "";
}

export function parseCv(entries: ContentEntry[]): CvData {
  const map = Object.fromEntries(entries.map((e) => [e.path, e.content]));
  const { bio, badges } = parseReadme(map["README.md"] ?? "");
  const posts = entries
    .filter((e) => e.path.startsWith("writings/") && !e.path.endsWith("README.md"))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => parsePost(e.content));
  return {
    bio,
    badges,
    roles: parseWork(map["work.md"] ?? ""),
    skillGroups: parseSkills(map["skills.md"] ?? ""),
    posts,
    degrees: parseList(map["education.md"] ?? ""),
    certs: parseCerts(map["certifications.md"] ?? ""),
    languages: parseList(map["languages.md"] ?? ""),
    interests: parseParagraph(map["interests.md"] ?? ""),
    contact: parseContact(map["contact.md"] ?? ""),
  };
}
