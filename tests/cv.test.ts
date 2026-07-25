import { describe, it, expect } from "vitest";
import { parseCv } from "@/modules/cv";
import { readContent } from "@/modules/content";
import { WRITINGS_ENABLED } from "@/modules/features";
import type { ContentEntry } from "@/modules/vfs";

describe("parseCv — real content", () => {
  const cv = parseCv(readContent());

  it("extracts bio paragraphs and skill badges from the README", () => {
    expect(cv.bio.length).toBeGreaterThanOrEqual(2);
    expect(cv.bio[0]).toMatch(/Full-stack software engineer/);
    expect(cv.badges).toContain("TypeScript");
    expect(cv.badges).toContain("Agentic AI");
    // badges must not swallow bio text
    expect(cv.badges.every((b) => b.length < 40)).toBe(true);
  });

  it("parses each role with a date, title and prose body (with **highlights**)", () => {
    expect(cv.roles.length).toBe(6);
    const roku = cv.roles[0];
    expect(roku.title).toMatch(/Roku/);
    expect(roku.date).toBe("Jul 2023 - now");
    expect(roku.body.length).toBeGreaterThanOrEqual(1);
    expect(roku.body.join(" ")).toMatch(/Partner Platform/);
    expect(roku.body.join(" ")).toMatch(/\*\*WebRTC\*\*/); // bold markers preserved for highlighting
  });

  it("parses contact details", () => {
    expect(cv.contact.email).toBe("hello@nandorszentpeteri.dev");
    expect(cv.contact.linkedin).toBe("linkedin.com/in/nandorszentpeteri"); // link stripped to text
    expect(cv.contact.github).toBe("github.com/nandorszentpeteri");
    expect(cv.contact.location).toBe("Leeds, UK");
  });

  it("takes the tagline from the closing prose line, not the bullets", () => {
    expect(cv.contact.tagline).toBe("Got an interesting problem? Let's talk.");
    expect(cv.contact.tagline).not.toMatch(/@|linkedin|github|Leeds/);
  });

  it("parses skill groups", () => {
    expect(cv.skillGroups.map((g) => g.label)).toEqual(["languages/", "tools/", "devops/"]);
    expect(cv.skillGroups[0].items).toMatch(/TypeScript/);
  });

  it.runIf(WRITINGS_ENABLED)("parses writing posts with tag + blurb", () => {
    expect(cv.posts.length).toBe(3);
    const ai = cv.posts.find((p) => p.tag.startsWith("AI"));
    expect(ai?.title).toMatch(/Agentic AI/);
    expect(ai?.blurb.length).toBeGreaterThan(20);
  });

  it.skipIf(WRITINGS_ENABLED)("serves no writing posts while the feature is off", () => {
    expect(cv.posts).toEqual([]);
  });

  it("reads degrees and certifications from their own files", () => {
    const certText = cv.certs.map((c) => c.text).join(" ");
    expect(cv.degrees.join(" ")).toMatch(/University of Debrecen/);
    expect(cv.degrees.join(" ")).not.toMatch(/DeepLearning/);
    expect(certText).toMatch(/DeepLearning\.AI/);
    expect(certText).not.toMatch(/Debrecen/);
  });

  it("lifts a cert's verification link out of its label", () => {
    const dl = cv.certs.find((c) => c.text.startsWith("DeepLearning.AI"));
    expect(dl?.url).toMatch(/^https:\/\/learn\.deeplearning\.ai\/certificates\//);
    // the link markup must not leak into the displayed text ("(Andrew Ng)" is fine)
    expect(dl?.text).not.toMatch(/verify|\[|\]\(|https/);
    expect(dl?.text).toMatch(/2026$/);
    // a cert with no link simply has none
    expect(cv.certs.find((c) => c.text.startsWith("Expert Training"))?.url).toBeUndefined();
  });

  it("parses languages and interests", () => {
    expect(cv.languages.join(" ")).toMatch(/English/);
    expect(cv.interests).toMatch(/mountain biking/);
  });
});

describe("parseCv — robustness", () => {
  it("handles missing files without throwing", () => {
    const entries: ContentEntry[] = [];
    const cv = parseCv(entries);
    expect(cv.roles).toEqual([]);
    expect(cv.badges).toEqual([]);
    expect(cv.bio).toEqual([]);
  });

  it("keeps role prose as paragraphs, split on blank lines", () => {
    const cv = parseCv([{ path: "work.md", content: "# Work\n\n## Role · Co\nJan 2020 — now\n\nDid a thing.\n\nThen another thing." }]);
    expect(cv.roles[0].date).toBe("Jan 2020 — now");
    expect(cv.roles[0].body).toEqual(["Did a thing.", "Then another thing."]);
  });
});
