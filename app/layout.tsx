import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { SITE_URL } from "@/modules/site";
import "@/theme/globals.css";

/* Fetched at build time and served from our own origin, so rendering the page
   costs the visitor no request to Google and leaks them no IP. `variable`
   exposes each family as a custom property; `globals.css` maps those onto
   --font-sans / --font-mono, which is what the stylesheet actually uses. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-space-grotesk",
});

/* Space Grotesk is variable and covers its whole range for free. Plex Mono ships
   as static cuts, so the weights have to be named — these are the three the
   stylesheet asks for. */
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Nandor Szentpeteri — Senior Software Engineer",
  description:
    "Full-stack software engineer with 13+ years shipping web apps across gaming, streaming and smart home. Now deep in agentic AI. Explore the terminal, or switch to the classic view.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Nandor Szentpeteri — Senior Software Engineer",
    description:
      "Full-stack engineer, 13+ years. A terminal you can actually type into — or a classic page if you'd rather scroll.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> before hydration.
          This suppresses that false-positive on this node's attributes only. */}
      <body suppressHydrationWarning>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
