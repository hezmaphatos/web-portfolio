import { Bricolage_Grotesque, JetBrains_Mono, Silkscreen } from "next/font/google";

/** Display + body. Variable: weight, optical size and width (condensed headlines use wdth 75). */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
  display: "swap",
});

/** HUD / pixel labels. */
export const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
  display: "swap",
});

/** Numbers, code, odometers (tabular figures). */
export const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVariables = `${bricolage.variable} ${silkscreen.variable} ${jetbrains.variable}`;
