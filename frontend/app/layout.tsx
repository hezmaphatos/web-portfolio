import type { Metadata, Viewport } from "next";

import { PREPAINT_SCRIPT } from "@/components/game/splash/prepaint";

import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
};

export const viewport: Viewport = {
  themeColor: "#F3EFE6",
};

/** Root: fonts only. The site chrome lives in app/(site)/layout.tsx, the admin in app/admin. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The pre-paint script adds data-lite / data-boot to <html> before React hydrates, so React
    // must accept attributes it did not render (suppressHydrationWarning only affects this element).
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Runs while <head> is parsed, before the first paint (see components/game/splash/prepaint.ts). */}
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
