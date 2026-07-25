/**
 * Server-only. Reads the `content/` directory at build time into a flat list of
 * entries that `buildVfs` mounts under the home directory. Runs during the
 * static export, so no filesystem access happens in the browser.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { WRITINGS_ENABLED } from "./features";
import type { ContentEntry } from "./vfs";

const CONTENT_DIR = join(process.cwd(), "content");

const toEntry = (full: string): ContentEntry => ({
  path: relative(CONTENT_DIR, full).split("\\").join("/"),
  content: readFileSync(full, "utf8"),
});

const walk = (dir: string): ContentEntry[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith(".md") ? [toEntry(full)] : [];
  });

/** Entries that stay on disk but are currently switched off. */
const isHidden = (entry: ContentEntry) => !WRITINGS_ENABLED && entry.path.startsWith("writings/");

export const readContent = (): ContentEntry[] =>
  walk(CONTENT_DIR)
    .filter((entry) => !isHidden(entry))
    .sort((a, b) => a.path.localeCompare(b.path));
