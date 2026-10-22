import type { Metadata, Viewport } from "next";

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
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
