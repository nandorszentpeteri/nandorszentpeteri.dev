/**
 * A tiny read-only virtual filesystem that backs the terminal.
 *
 * Content lives as real markdown files under `content/`. At build time we read
 * them into a flat list and mount them under the home directory, so `ls`,
 * `cd`, `cat` and friends operate on an actual tree — not a switch statement.
 */

export type VfsFile = {
  type: "file";
  name: string;
  content: string;
};

export type VfsDir = {
  type: "dir";
  name: string;
  children: Record<string, VfsNode>;
};

export type VfsNode = VfsFile | VfsDir;

/** A flat content entry as read from disk, e.g. `{ path: "work/roku.md", content }`. */
export type ContentEntry = {
  path: string;
  content: string;
};

/** Home directory, as absolute path segments. cwd starts here and `~` expands to it. */
export const HOME_SEGMENTS = ["home", "nandor"] as const;
export const HOME_PATH = "/" + HOME_SEGMENTS.join("/");

export function isDir(node: VfsNode | null | undefined): node is VfsDir {
  return !!node && node.type === "dir";
}

export function isFile(node: VfsNode | null | undefined): node is VfsFile {
  return !!node && node.type === "file";
}

function emptyDir(name: string): VfsDir {
  // Object.create(null), not {}: a plain literal inherits Object.prototype, so a
  // path segment like `__proto__`, `constructor` or `toString` would resolve to
  // an inherited property and be handed back as if it were a real node. `cat
  // __proto__` then threw on `node.content`, and `cd __proto__` left the shell
  // in a phantom directory where every later `ls` threw. A prototype-less object
  // has nothing to inherit, so those lookups miss and return null as intended.
  return { type: "dir", name, children: Object.create(null) as Record<string, VfsNode> };
}

/**
 * Build the full filesystem tree from flat content entries, mounting every
 * entry under the home directory. Returns the root node (`/`).
 */
export function buildVfs(entries: ContentEntry[]): VfsDir {
  const root = emptyDir("");

  // Ensure /home/nandor exists even if there is no content.
  let home: VfsDir = root;
  for (const seg of HOME_SEGMENTS) {
    if (!isDir(home.children[seg])) home.children[seg] = emptyDir(seg);
    home = home.children[seg] as VfsDir;
  }

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    const fileName = parts[parts.length - 1];
    const dirParts = parts.slice(0, -1);

    let dir = home;
    for (const part of dirParts) {
      if (!isDir(dir.children[part])) dir.children[part] = emptyDir(part);
      dir = dir.children[part] as VfsDir;
    }

    dir.children[fileName] = { type: "file", name: fileName, content: entry.content };
  }

  return root;
}

/** Collapse `.` and `..` segments. Leading `..` at the root are dropped. */
export function normalizeSegments(segments: string[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Resolve `target` against `cwd` (an absolute path). Supports absolute paths,
 * relative paths, `~` (home), `.` and `..`. Returns an absolute path string.
 */
export function resolvePath(cwd: string, target: string): string {
  const raw = (target ?? "").trim();

  let base: string[];
  let rest: string;

  if (raw === "~" || raw.startsWith("~/")) {
    base = [...HOME_SEGMENTS];
    rest = raw === "~" ? "" : raw.slice(2);
  } else if (raw.startsWith("/")) {
    base = [];
    rest = raw;
  } else if (raw === "") {
    // No argument resolves to cwd.
    base = cwd.split("/").filter(Boolean);
    rest = "";
  } else {
    base = cwd.split("/").filter(Boolean);
    rest = raw;
  }

  const combined = [...base, ...rest.split("/")];
  const normalized = normalizeSegments(combined);
  return "/" + normalized.join("/");
}

/** Look up a node by absolute path. Returns null if any segment is missing. */
export function getNode(root: VfsDir, absPath: string): VfsNode | null {
  const parts = absPath.split("/").filter(Boolean);
  let node: VfsNode = root;
  for (const part of parts) {
    if (!isDir(node)) return null;
    const child: VfsNode | undefined = node.children[part];
    if (!child) return null;
    node = child;
  }
  return node;
}

/** Sorted child names of a directory, directories first then files. */
export function listChildren(dir: VfsDir): { dirs: string[]; files: string[] } {
  const dirs: string[] = [];
  const files: string[] = [];
  for (const [name, node] of Object.entries(dir.children)) {
    if (node.type === "dir") dirs.push(name);
    else files.push(name);
  }
  dirs.sort();
  files.sort();
  return { dirs, files };
}

/** Turn an absolute path into a display path, shortening the home dir to `~`. */
export function displayPath(absPath: string): string {
  if (absPath === HOME_PATH) return "~";
  if (absPath.startsWith(HOME_PATH + "/")) return "~" + absPath.slice(HOME_PATH.length);
  return absPath === "" ? "/" : absPath;
}
