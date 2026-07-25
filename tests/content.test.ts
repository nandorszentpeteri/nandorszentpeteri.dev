import { describe, it, expect } from "vitest";
import { readContent } from "@/modules/content";
import { WRITINGS_ENABLED } from "@/modules/features";
import { buildVfs, getNode, isFile, HOME_PATH } from "@/modules/vfs";
import { ALIASES, runCommand } from "@/modules/commands";

// Integration: the real markdown files on disk should mount into a working tree.
describe("real content", () => {
  const entries = readContent();
  const root = buildVfs(entries);

  it("reads markdown files from content/", () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.path.endsWith(".md"))).toBe(true);
  });

  it("mounts the expected files", () => {
    expect(isFile(getNode(root, `${HOME_PATH}/README.md`))).toBe(true);
    expect(isFile(getNode(root, `${HOME_PATH}/work.md`))).toBe(true);
    expect(isFile(getNode(root, `${HOME_PATH}/contact.md`))).toBe(true);
    expect(isFile(getNode(root, `${HOME_PATH}/education.md`))).toBe(true);
    expect(isFile(getNode(root, `${HOME_PATH}/certifications.md`))).toBe(true);
  });

  it.runIf(WRITINGS_ENABLED)("mounts the writings folder", () => {
    expect(isFile(getNode(root, `${HOME_PATH}/writings/README.md`))).toBe(true);
  });

  it.skipIf(WRITINGS_ENABLED)("leaves the writings folder unmounted", () => {
    expect(getNode(root, `${HOME_PATH}/writings`)).toBe(null);
    expect(entries.some((e) => e.path.startsWith("writings/"))).toBe(false);
  });

  it("every alias target resolves to a real file", () => {
    // work -> ~/work.md, about -> ~/README.md, etc.
    for (const cmd of Object.keys(ALIASES)) {
      const r = runCommand(root, { cwd: HOME_PATH }, cmd);
      const joined = r.lines.map((l) => l.text).join("\n");
      expect(joined, `alias "${cmd}" should print file content`).not.toMatch(/no such file or directory/);
      expect(joined.length).toBeGreaterThan(0);
    }
  });
});
