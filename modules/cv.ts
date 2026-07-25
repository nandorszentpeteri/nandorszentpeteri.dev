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
  /** The `# Heading` of README.md — the one place the name is written down. */
  name: string;
  /** The `**bold**` line under it, e.g. "Senior Software Engineer @ Roku · Leeds, UK". */
  headline: string;
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

type Readme = { name: string; headline: string; bio: string[]; badges: string[] };

const parseReadme = (content: string): Readme => {
  const bio: string[] = [];
  let name = "";
  let headline = "";
  let badges: string[] = [];
  for (const block of blocks(content)) {
    const heading = /^#\s+(.+)/.exec(block);
    if (heading) {
      name = name || heading[1].trim();
      continue;
    }
    if (block.startsWith("#")) continue; // deeper heading
    const bold = /^\*\*(.*)\*\*$/.exec(block);
    if (bold) {
      headline = headline || bold[1].trim();
      continue;
    }
    const codes = [...block.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // a line made up only of `code` tokens (and separators) is the badge row
    if (codes.length >= 2 && block.replace(/`[^`]+`/g, "").replace(/[·•\s]/g, "") === "") {
      badges = codes;
      continue;
    }
    bio.push(unwrap(block));
  }
  return { name, headline, bio, badges };
};

const parseWork = (content: string): Role[] => {
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
};

const parseContact = (content: string): Contact => {
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
};

const parseSkills = (content: string): SkillGroup[] => {
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
};

const parsePost = (content: string): Post => {
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
};

/** A trailing `· [label](url)` on a cert bullet is the issuer's verification link. */
const CERT_LINK = /\s*[·•]\s*\[[^\]]+\]\(([^)]+)\)\s*$/;

const parseCert = (bullet: string): Cert => {
  const link = CERT_LINK.exec(bullet);
  return link
    ? { text: stripInline(bullet.slice(0, link.index)), url: link[1] }
    : { text: stripInline(bullet) };
};

const parseCerts = (content: string): Cert[] => {
  const certs: Cert[] = [];
  for (const raw of content.split("\n")) {
    const bullet = /^-\s+(.+)/.exec(raw.replace(/\r$/, ""));
    if (bullet) certs.push(parseCert(bullet[1]));
  }
  return certs;
};

const parseList = (content: string): string[] => {
  const out: string[] = [];
  for (const raw of content.split("\n")) {
    const b = /^-\s+(.+)/.exec(raw);
    if (b) out.push(stripInline(b[1]));
  }
  return out;
};

const parseParagraph = (content: string): string => {
  for (const block of blocks(content)) {
    if (block.startsWith("#")) continue;
    return unwrap(block);
  }
  return "";
};

export const parseCv = (entries: ContentEntry[]): CvData => {
  const map = Object.fromEntries(entries.map((e) => [e.path, e.content]));
  const { name, headline, bio, badges } = parseReadme(map["README.md"] ?? "");
  const posts = entries
    .filter((e) => e.path.startsWith("writings/") && !e.path.endsWith("README.md"))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => parsePost(e.content));
  return {
    name,
    headline,
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
};
