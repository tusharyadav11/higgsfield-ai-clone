import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
import { ACCENT_BOOT_SNIPPET } from "@/lib/color";
import { ACCENTS, ACCENT_COOKIE, DEFAULT_ACCENT, DEFAULT_THEME, THEME_BOOT_SNIPPET } from "@/lib/theme";

// Runs before first paint: restores the saved accent so there is no colour flash.
const accentBoot = `try{var a=localStorage.getItem("${ACCENT_COOKIE}");if(${JSON.stringify(ACCENTS)}.indexOf(a)>-1)document.documentElement.dataset.accent=a}catch(e){}`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Kinetic - AI creative studio", template: "%s | Kinetic" },
  description: "Remix a prompt in one click. Generate images and video with the best models.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-accent={DEFAULT_ACCENT}
      data-theme={DEFAULT_THEME}
      data-theme-mode={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SNIPPET }} />
        <script dangerouslySetInnerHTML={{ __html: accentBoot }} />
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SNIPPET }} />
      </head>
      <body className="min-h-full">
        <Shell initialAccent={DEFAULT_ACCENT}>{children}</Shell>
      </body>
    </html>
  );
}
