import { describe, it, expect } from "vitest";

import { ALIASES, runCommand, type Identity } from "@/modules/commands";
import { readContent } from "@/modules/content";
import { parseCv } from "@/modules/cv";
import { WRITINGS_ENABLED } from "@/modules/features";
import { buildVfs, getNode, isFile, HOME_PATH } from "@/modules/vfs";

// Integration: the real markdown files on disk should mount into a working tree.
describe("real content", () => {
  const entries = readContent();
  const root = buildVfs(entries);
  const { name, headline, contact } = parseCv(entries);
  const identity: Identity = { name, headline, contact };
  const state = { cwd: HOME_PATH, identity };
  const text = (input: string) =>
    runCommand(root, state, input)
      .lines.map((l) => l.text)
      .join("\n");

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
      const joined = text(cmd);
      expect(joined, `alias "${cmd}" should print file content`).not.toMatch(/no such file or directory/);
      expect(joined.length).toBeGreaterThan(0);
    }
  });

  it("parses a name and headline out of README.md", () => {
    expect(name).not.toBe("");
    expect(headline).not.toBe("");
  });

  it("parses a contact email out of contact.md", () => {
    expect(contact.email).toMatch(/@/);
  });

  it("hands out the published address, not a second one", () => {
    // The whole point of the domain alias: exactly one address ships.
    for (const cmd of ["contact-me", "hire-me", "sudo hire-me"]) {
      expect(text(cmd), `"${cmd}" should quote contact.md`).toContain(contact.email);
    }
  });

  it("whoami agrees with README.md", () => {
    expect(text("whoami")).toContain(name);
    expect(text("whoami")).toContain(headline);
  });
});
