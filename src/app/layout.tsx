import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible,
  DM_Sans,
  Fraunces,
  Inter,
  JetBrains_Mono,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const appearanceFonts = [dmSans, fraunces, inter, sourceSerif, atkinson, jetbrainsMono]
  .map((font) => font.variable)
  .join(" ");

// Applies the saved appearance preferences before first paint so the page
// doesn't flash the default theme/font/size and then jump to the saved one.
const applyAppearanceScript = `
(function () {
  try {
    var root = document.documentElement;
    var bg = localStorage.getItem("qe-bg-theme");
    var font = localStorage.getItem("qe-font");
    var size = localStorage.getItem("qe-font-size");
    if (bg) root.setAttribute("data-bg-theme", bg);
    if (font) root.setAttribute("data-font", font);
    if (size) root.setAttribute("data-font-size", size);
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "QE Knowledge Base",
  description: "A local-first software engineering knowledge base.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={appearanceFonts} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyAppearanceScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
