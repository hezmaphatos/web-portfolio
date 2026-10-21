import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yehezkiel Natanael",
  description: "Portfolio of Yehezkiel “Hackker” Natanael",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
