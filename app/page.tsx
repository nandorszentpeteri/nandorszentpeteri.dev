import { Badges } from "@/components/Badges";
import { ContactBlock, ContactCompact, ContactTagline } from "@/components/ContactBlock";
import { Terminal } from "@/components/terminal/Terminal";
import { WhoamiHeader } from "@/components/WhoamiHeader";
import { NeonBackground } from "@/layout/NeonBackground";
import { ViewToggle } from "@/layout/ViewToggle";
import { readContent } from "@/modules/content";
import { parseCv } from "@/modules/cv";
import { TEXT } from "@/theme/palette";

export default function Home() {
  // Read at build time; the browser only ever receives the resulting tree.
  const entries = readContent();
  // Same parse the classic page uses, so the pills and contact rows match on both views.
  const { badges, contact, name, headline } = parseCv(entries);

  return (
    // Pinned to the viewport: the terminal view always fills the page and the
    // window itself never scrolls (the terminal scrolls internally instead).
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <NeonBackground />

      {/* top bar */}
      <div className="topbar" style={{ position: "relative", zIndex: 2 }}>
        <span className="topbar-path">~/nandorszentpeteri.dev</span>
        <ViewToggle active="terminal" />
      </div>

      {/* two-column scene */}
      <div
        className="home-content"
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
          maxWidth: 1600,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* identity — layout lives in globals.css so the mobile rule can override it */}
        <div className="home-identity enter">
          <WhoamiHeader name={name} nameSize="clamp(22px,2.8vw,36px)" />
          <div className="home-hide-sm" style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, lineHeight: 1.65, color: TEXT.muted }}>
            <p style={{ margin: 0 }}>
              Full-stack software engineer with 13+ years of experience building and shipping web applications. I&apos;ve
              worked at every layer of the stack, from React and Next.js front-ends to back-end microservices and CI/CD
              pipelines.
            </p>
            <p style={{ margin: 0 }}>
              For the past year, AI has become central to how I work. I use LLMs daily in my engineering workflow and
              have invested heavily in agentic AI — building automation workflows and finding real-life applications of
              agentic systems, not just in engineering.
            </p>
          </div>
          <Badges items={badges} className="home-hide-sm" />
          <ContactBlock contact={contact} className="home-hide-sm" />
          <ContactCompact contact={contact} />
          {/* On desktop the tagline closes the identity column. On a phone the
              column is stacked above the terminal, and a gradient CTA there made
              an already-loud first screen louder — so that copy is dropped and
              the one below the terminal takes over. Two renders rather than one
              because the two positions are in different flex containers; only
              ever one of them is displayed. */}
          <ContactTagline
            text={contact.tagline}
            cta={contact.taglineCta}
            email={contact.email}
            align="left"
            className="home-hide-sm"
          />
        </div>

        {/* terminal */}
        <div className="home-terminal enter" style={{ ["--enter-delay" as string]: ".08s" }}>
          {/* The shell answers `whoami` / `contact-me` from the same parse, so no
              address or job title is written down twice. */}
          <Terminal entries={entries} identity={{ name, headline, contact }} />
        </div>

        {/* the phone-only copy of the closing line — see the note above */}
        <ContactTagline
          text={contact.tagline}
          cta={contact.taglineCta}
          email={contact.email}
          className="home-tagline-sm enter"
        />
      </div>
    </div>
  );
}
