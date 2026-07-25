import type { Metadata } from "next";

import { Badges } from "@/components/Badges";
import { ContactBlock, ContactTagline } from "@/components/ContactBlock";
import { WhoamiHeader } from "@/components/WhoamiHeader";
import { NeonBackground } from "@/layout/NeonBackground";
import { ViewToggle } from "@/layout/ViewToggle";
import { readContent } from "@/modules/content";
import { parseCv } from "@/modules/cv";
import { BORDER, PALETTE, TEXT, fade } from "@/theme/palette";

export const metadata: Metadata = {
  title: "Nandor Szentpeteri — CV (classic view)",
  description: "The plain, scroll-friendly version of Nandor Szentpeteri's CV.",
};

const CYAN = PALETTE.cyan;
const PINK = PALETTE.pink;
const GREEN = PALETTE.green;
const CARD_COLORS = [CYAN, PINK, GREEN];

/**
 * Render **bold** project/tech names as highlights within prose.
 *
 * Not an accent colour: every accent on this page is already spoken for by a
 * link, so cyan highlights read as links that don't click. The emphasis is
 * weight and a lift out of the muted body colour to full white instead —
 * unmistakably "this matters", unmistakably not a destination.
 */
const withHighlights = (text: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} style={{ color: TEXT.strong, fontWeight: 600 }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );

/** Tag colour for a writing card, e.g. "WEB · DRAFTING" → pink. */
const tagColor = (tag: string): string => {
  const head = tag.split("·")[0].trim().toUpperCase();
  if (head === "AI") return GREEN;
  if (head === "WEB") return PINK;
  return CYAN;
};

interface SectionTitleProps {
  children: React.ReactNode;
}

/* Section width and padding live in globals.css (.cv-section), so phones get
   narrower gutters without every section repeating a media query. */

const SectionTitle = ({ children }: SectionTitleProps) => (
  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 11, letterSpacing: ".3em", color: PALETTE.purple, marginBottom: 20 }}>
    {children}
  </div>
);

export default function Classic() {
  // Parsed from the same content/*.md the terminal serves — single source.
  const cv = parseCv(readContent());

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>
      {/* fixed background so the scene stays put while the page scrolls */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <NeonBackground />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* top bar — identical to the terminal view so it doesn't jump */}
        <div className="topbar">
          <span className="topbar-path">~/nandorszentpeteri.dev</span>
          <ViewToggle active="classic" />
        </div>

        {/* hero */}
        {/* The entrance is on the children rather than on this header, so the
            name, portrait and typed role can hold still on a phone while the
            prose below them still fades in. Opacity inherits — a fade here
            would take the name with it, whatever the children asked for. */}
        <header className="cv-section cv-section-hero">
          <div style={{ marginBottom: 24 }}>
            <WhoamiHeader name={cv.name} className="enter-still-sm" />
          </div>
          <div className="enter" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, fontSize: 14, lineHeight: 1.65, color: TEXT.muted, marginBottom: 22 }}>
            {cv.bio.map((p, i) => (
              <p key={i} style={{ margin: 0 }}>
                {p}
              </p>
            ))}
          </div>
          <Badges items={cv.badges} className="enter" />

          {/* the same block the terminal view's identity column renders */}
          <div className="enter" style={{ marginTop: 24 }}>
            <ContactBlock contact={cv.contact} />
          </div>
        </header>

        {/* work */}
        <section className="cv-section">
          <SectionTitle>// WORK EXPERIENCE</SectionTitle>
          <div>
            {cv.roles.map((role, i) => (
              <div
                key={role.title + role.date}
                className="cv-role"
                style={{ borderBottom: i < cv.roles.length - 1 ? `1px solid ${BORDER.subtle}` : "none" }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: CYAN }}>{role.date}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontWeight: 500, fontSize: 17 }}>{role.title}</div>
                  {role.body.map((para, j) => (
                    <p key={j} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: TEXT.muted }}>
                      {withHighlights(para)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* skills */}
        <section className="cv-section">
          <SectionTitle>// TECHNICAL SKILLS</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
            {cv.skillGroups.map((g, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length];
              // Border and tint were `${color}40` / `${color}0a` — hex-alpha
              // suffixes, which can't be appended to a var(). Same alphas via fade.
              return (
                <div key={g.label} style={{ border: `1px solid ${fade(color, 25)}`, borderRadius: 8, padding: 20, background: fade(color, 4) }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 12, color, marginBottom: 12 }}>{g.label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.9, color: TEXT.secondary }}>{g.items}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* writing — empty while WRITINGS_ENABLED is off (see modules/features.ts) */}
        {cv.posts.length > 0 && (
          <section className="cv-section">
            <SectionTitle>// WRITING</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
              {cv.posts.map((p) => {
                const color = tagColor(p.tag);
                return (
                  <div
                    key={p.title}
                    className="cv-card"
                    style={{ ["--accent" as string]: color, display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${BORDER.medium}`, borderRadius: 8, padding: 22 }}
                  >
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".2em", color }}>{p.tag.toUpperCase()}</div>
                    <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>{p.title}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: fade(PALETTE.white, 50) }}>{p.blurb}</div>
                    <div style={{ marginTop: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: TEXT.label }}>coming soon →</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* education */}
        <section className="cv-section">
          <SectionTitle>// EDUCATION</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 15, color: TEXT.primary }}>
            {cv.degrees.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
        </section>

        {/* certs */}
        <section className="cv-section">
          <SectionTitle>// CERTIFICATIONS</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 15, color: TEXT.primary }}>
            {cv.certs.map((c) => (
              <div key={c.text}>
                {c.text}
                {/* no `download` attribute — the issuer's page opens, nothing is saved */}
                {c.url && (
                  <a className="link" href={c.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12, fontFamily: "var(--font-mono)", fontSize: 12, color: CYAN }}>
                    verify ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>


        {/* languages + interests */}
        <section className="cv-section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 32 }}>
          <div>
            <SectionTitle>// LANGUAGES</SectionTitle>
            <div style={{ fontSize: 15, color: TEXT.primary, lineHeight: 1.8 }}>
              {cv.languages.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle>// OFF-KEYBOARD</SectionTitle>
            <div style={{ fontSize: 15, color: TEXT.primary, lineHeight: 1.7 }}>{cv.interests}</div>
          </div>
        </section>

        {/* footer — contact details live in the hero block, not repeated here */}
        <section className="cv-section cv-section-footer">
          <ContactTagline text={cv.contact.tagline} cta={cv.contact.taglineCta} email={cv.contact.email} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, paddingTop: 24, borderTop: `1px solid ${BORDER.subtle}`, fontFamily: "var(--font-mono)", fontSize: 11, color: TEXT.faint }}>
            <span>© 2026 Nandor Szentpeteri</span>
            <span>built with Next.js · deployed on Vercel</span>
          </div>
        </section>
      </div>
    </div>
  );
}
