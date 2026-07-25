import type { Metadata } from "next";

import { SITE_URL } from "@/modules/site";
import "@/theme/globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> before hydration.
          This suppresses that false-positive on this node's attributes only. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
