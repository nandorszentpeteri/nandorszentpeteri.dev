import { describe, it, expect } from "vitest";

import { readContent } from "@/modules/content";
import { parseCv } from "@/modules/cv";
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

  it("takes the name from the README heading", () => {
    expect(cv.name).toBe("Nandor Szentpeteri");
  });

  it("takes the headline from the bold line under it", () => {
    expect(cv.headline).toBe("Senior Software Engineer @ Roku · Leeds, UK");
  });

  it("keeps the name and headline out of the bio", () => {
    expect(cv.bio.join(" ")).not.toContain(cv.name);
    expect(cv.bio.join(" ")).not.toContain(cv.headline);
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

  it("takes the tagline CTA from the bolded run", () => {
    expect(cv.contact.taglineCta).toBe("Let's talk.");
  });

  it("keeps the CTA a substring of the tagline so it can be located", () => {
    expect(cv.contact.tagline).toContain(cv.contact.taglineCta);
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

  it("leaves the tagline CTA empty when nothing is bolded", () => {
    const cv = parseCv([{ path: "contact.md", content: "# Contact\n\nJust say hi." }]);
    expect(cv.contact.tagline).toBe("Just say hi.");
    expect(cv.contact.taglineCta).toBe("");
  });

  it("strips the bold markers out of the plain tagline", () => {
    const cv = parseCv([{ path: "contact.md", content: "# Contact\n\nSay **hello** now." }]);
    expect(cv.contact.tagline).toBe("Say hello now.");
    expect(cv.contact.taglineCta).toBe("hello");
  });

  it("falls back to empty strings when the README is missing", () => {
    const cv = parseCv([]);
    expect(cv.name).toBe("");
    expect(cv.headline).toBe("");
  });

  it("ignores a second heading when picking the name", () => {
    const cv = parseCv([{ path: "README.md", content: "# First\n\n**A headline**\n\n# Second" }]);
    expect(cv.name).toBe("First");
  });

  it("keeps role prose as paragraphs, split on blank lines", () => {
    const cv = parseCv([{ path: "work.md", content: "# Work\n\n## Role · Co\nJan 2020 — now\n\nDid a thing.\n\nThen another thing." }]);
    expect(cv.roles[0].date).toBe("Jan 2020 — now");
    expect(cv.roles[0].body).toEqual(["Did a thing.", "Then another thing."]);
  });
});
