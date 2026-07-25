import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ContactTagline } from "@/components/ContactBlock";

const TEXT = "Got an interesting problem? Let's talk.";
const CTA = "Let's talk.";
const EMAIL = "ada@example.dev";

describe("ContactTagline", () => {
  it("links the bolded run as a mailto", () => {
    render(<ContactTagline text={TEXT} cta={CTA} email={EMAIL} />);
    expect(screen.getByRole("link", { name: CTA }).getAttribute("href")).toContain(`mailto:${EMAIL}`);
  });

  it("prefills a subject on the mailto", () => {
    render(<ContactTagline text={TEXT} cta={CTA} email={EMAIL} />);
    expect(screen.getByRole("link", { name: CTA }).getAttribute("href")).toContain("subject=");
  });

  it("keeps the whole sentence readable, not just the link", () => {
    const { container } = render(<ContactTagline text={TEXT} cta={CTA} email={EMAIL} />);
    expect(container.textContent).toBe(TEXT);
  });

  it("renders plain text when nothing is bolded", () => {
    render(<ContactTagline text={TEXT} cta="" email={EMAIL} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders plain text when there is no address to write to", () => {
    render(<ContactTagline text={TEXT} cta={CTA} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("falls back to plain text when the CTA is not part of the tagline", () => {
    // e.g. the markdown was reworded so the bolded run no longer matches
    render(<ContactTagline text={TEXT} cta="something else" email={EMAIL} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(TEXT)).toBeInTheDocument();
  });
});
