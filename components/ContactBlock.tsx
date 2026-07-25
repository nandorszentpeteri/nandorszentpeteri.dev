import type { Contact } from "@/modules/cv";
import { BORDER, PALETTE, TEXT } from "@/theme/palette";

/** Lives in public/, so the href is the served path rather than a bundled import. */
export const CV_FILE = "/nandorszentpeteri-cv.pdf";
/** Shown as the link text, derived so it can't drift from what actually downloads. */
const CV_NAME = CV_FILE.slice(1);

interface RowProps {
  name: string;
  children: React.ReactNode;
}

const Row = ({ name, children }: RowProps) => (
  <div>
    {/* width lives in globals.css so it can narrow on small phones */}
    <span className="contact-label">{name}</span>
    {children}
  </div>
);

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

interface ContactBlockProps {
  contact: Contact;
  className?: string;
}

/**
 * The contact rows shared by the terminal view's identity column and the
 * classic view's hero. Every value comes from content/contact.md via parseCv,
 * so the two views can't drift apart.
 */
export const ContactBlock = ({ contact, className }: ContactBlockProps) => (
  <div
    className={className}
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      borderTop: `1px solid ${BORDER.soft}`,
      paddingTop: 18,
      maxWidth: 440,
    }}
  >
    <Row name="email">
      <a className="link" href={`mailto:${contact.email}`} style={{ color: PALETTE.cyan }}>
        {contact.email}
      </a>
    </Row>
    <Row name="linkedin">
      <a className="link" href={`https://${contact.linkedin}`} {...external} style={{ color: PALETTE.pink }}>
        {contact.linkedin}
      </a>
    </Row>
    <Row name="github">
      <a className="link" href={`https://${contact.github}`} {...external} style={{ color: PALETTE.purple }}>
        {contact.github}
      </a>
    </Row>
    <Row name="location">
      <span style={{ color: TEXT.secondary }}>{contact.location}</span>
    </Row>
    <Row name="cv">
      {/* green: the only unused accent, and the terminal already uses it for
          actions — which also stops this row reading as inert text like the
          location above it */}
      <a className="link" href={CV_FILE} download style={{ color: PALETTE.green }}>
        {CV_NAME} ↓
      </a>
    </Row>
  </div>
);

interface ContactCompactProps {
  contact: Contact;
}

/**
 * The phone-sized contact row: the four tappable destinations reduced to their
 * labels, on one wrapping line. Written-out URLs cost ~130px of column height
 * that the terminal needs, and nobody reads a URL on a phone — they tap it.
 * Location is dropped here: it isn't a link, and it's on the CV and the classic
 * view for anyone who wants it.
 *
 * Shown/hidden purely in CSS (`.contact-compact`) rather than by measuring the
 * viewport in JS, because this page is statically exported: a JS switch would
 * render the wrong variant on the server and visibly swap after hydration.
 */
export const ContactCompact = ({ contact }: ContactCompactProps) => {
  // A slash reads as a path segment, which suits the terminal framing better
  // than a mid-dot and costs no extra width.
  const sep = <span style={{ color: TEXT.faint }}>/</span>;
  return (
    <div className="contact-compact">
      <a className="link" href={`mailto:${contact.email}`} style={{ color: PALETTE.cyan }}>
        email
      </a>
      {sep}
      <a className="link" href={`https://${contact.linkedin}`} {...external} style={{ color: PALETTE.pink }}>
        linkedin
      </a>
      {sep}
      <a className="link" href={`https://${contact.github}`} {...external} style={{ color: PALETTE.purple }}>
        github
      </a>
      {sep}
      <a className="link" href={CV_FILE} download style={{ color: PALETTE.green }}>
        cv ↓
      </a>
    </div>
  );
};

interface ContactTaglineProps {
  text: string;
  align?: "left" | "center";
}

/**
 * The closing line from contact.md, at the foot of whatever contains it.
 * Centred on the classic page's full-width footer; left-aligned in the
 * terminal view's narrow identity column, where centring leaves it stranded.
 */
// Centring is a margin rather than text-align: the element is width:fit-content
// so the gradient tracks the text, which means text-align has nothing to act on.
export const ContactTagline = ({ text, align = "center" }: ContactTaglineProps) => (
  <div className={`gradient-text tagline${align === "center" ? " tagline-center" : ""}`}>{text}</div>
);
