import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const appUrl = process.env.APP_URL ?? "https://lostfound.project.webpeaker.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Campus Lost & Found",
    template: "%s · Campus Lost & Found",
  },
  description:
    "Report lost and found items on campus, match with privacy-preserving verification, and track every supervised handover in an auditable custody chain.",
  applicationName: "Campus Lost & Found",
  keywords: [
    "campus lost and found",
    "lost and found",
    "found item",
    "lost item",
    "ownership verification",
    "custody chain",
    "university",
  ],
  authors: [{ name: "Campus Lost & Found" }],
  creator: "Campus Lost & Found",
  category: "education",
  referrer: "origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "Campus Lost & Found",
    title: "Campus Lost & Found",
    description:
      "Lost it? Found it? Get it back. Report in under a minute, verify ownership privately, and collect through a supervised handover.",
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Campus Lost & Found",
    description:
      "Privacy-first campus lost & found: automatic matches, encrypted ownership checks, supervised handovers.",
  },
  appleWebApp: {
    capable: true,
    title: "Lost & Found",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f7f8fb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
