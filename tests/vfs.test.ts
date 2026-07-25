import { describe, it, expect } from "vitest";
import {
  buildVfs,
  resolvePath,
  normalizeSegments,
  getNode,
  listChildren,
  displayPath,
  isDir,
  isFile,
  HOME_PATH,
  type ContentEntry,
} from "@/modules/vfs";

const ENTRIES: ContentEntry[] = [
  { path: "README.md", content: "# Home" },
  { path: "work/README.md", content: "# Work" },
  { path: "work/roku.md", content: "# Roku" },
  { path: "skills/README.md", content: "# Skills" },
];

describe("buildVfs", () => {
  const root = buildVfs(ENTRIES);

  it("mounts content under the home directory", () => {
    const home = getNode(root, HOME_PATH);
    expect(isDir(home)).toBe(true);
    expect(getNode(root, `${HOME_PATH}/README.md`)).toMatchObject({ type: "file", content: "# Home" });
    expect(getNode(root, `${HOME_PATH}/work/roku.md`)).toMatchObject({ type: "file", content: "# Roku" });
  });

  it("creates intermediate directories", () => {
    expect(isDir(getNode(root, `${HOME_PATH}/work`))).toBe(true);
    expect(isDir(getNode(root, `${HOME_PATH}/skills`))).toBe(true);
  });

  it("always provides a home directory even with no content", () => {
    const empty = buildVfs([]);
    expect(isDir(getNode(empty, HOME_PATH))).toBe(true);
  });
});

describe("normalizeSegments", () => {
  it("drops '.' and empty segments", () => {
    expect(normalizeSegments(["a", ".", "", "b"])).toEqual(["a", "b"]);
  });
  it("pops on '..'", () => {
    expect(normalizeSegments(["a", "b", "..", "c"])).toEqual(["a", "c"]);
  });
  it("ignores '..' past the root", () => {
    expect(normalizeSegments(["..", "..", "a"])).toEqual(["a"]);
  });
});

describe("resolvePath", () => {
  it("resolves relative paths against cwd", () => {
    expect(resolvePath(HOME_PATH, "work")).toBe(`${HOME_PATH}/work`);
  });
  it("expands ~ to the home directory", () => {
    expect(resolvePath("/tmp", "~")).toBe(HOME_PATH);
    expect(resolvePath("/tmp", "~/work")).toBe(`${HOME_PATH}/work`);
  });
  it("handles absolute paths", () => {
    expect(resolvePath(HOME_PATH, "/etc/hosts")).toBe("/etc/hosts");
  });
  it("handles .. and .", () => {
    expect(resolvePath(`${HOME_PATH}/work`, "..")).toBe(HOME_PATH);
    expect(resolvePath(`${HOME_PATH}/work`, "./roku.md")).toBe(`${HOME_PATH}/work/roku.md`);
  });
  it("returns cwd for an empty target", () => {
    expect(resolvePath(HOME_PATH, "")).toBe(HOME_PATH);
  });
  it("resolves the filesystem root", () => {
    expect(resolvePath(HOME_PATH, "/")).toBe("/");
  });
});

describe("getNode", () => {
  const root = buildVfs(ENTRIES);
  it("returns null for missing paths", () => {
    expect(getNode(root, `${HOME_PATH}/nope`)).toBeNull();
    expect(getNode(root, `${HOME_PATH}/README.md/child`)).toBeNull();
  });
  it("returns the root for '/'", () => {
    expect(isDir(getNode(root, "/"))).toBe(true);
  });
  it("distinguishes files and dirs", () => {
    expect(isFile(getNode(root, `${HOME_PATH}/README.md`))).toBe(true);
    expect(isDir(getNode(root, `${HOME_PATH}/work`))).toBe(true);
  });
});

describe("listChildren", () => {
  it("returns sorted dirs and files separately", () => {
    const root = buildVfs(ENTRIES);
    const home = getNode(root, HOME_PATH);
    if (!isDir(home)) throw new Error("home should be a dir");
    const { dirs, files } = listChildren(home);
    expect(dirs).toEqual(["skills", "work"]);
    expect(files).toEqual(["README.md"]);
  });
});

describe("displayPath", () => {
  it("shortens the home directory to ~", () => {
    expect(displayPath(HOME_PATH)).toBe("~");
    expect(displayPath(`${HOME_PATH}/work`)).toBe("~/work");
    expect(displayPath("/etc")).toBe("/etc");
  });
});

describe("prototype-chain path segments", () => {
  const root = buildVfs([{ path: "README.md", content: "# hi" }]);

  // `children` used to be a plain {} literal, so these segments resolved to
  // inherited Object.prototype members and were returned as if they were nodes.
  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"])(
    "resolves %s to null rather than an inherited property",
    (segment) => {
      expect(getNode(root, `${HOME_PATH}/${segment}`)).toBe(null);
    },
  );

  it("keeps real children reachable", () => {
    expect(isFile(getNode(root, `${HOME_PATH}/README.md`))).toBe(true);
  });
});
