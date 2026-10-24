import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
import { ACCENTS, ACCENT_COOKIE, DEFAULT_ACCENT } from "@/lib/theme";

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
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-accent={DEFAULT_ACCENT}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: accentBoot }} />
      </head>
      <body className="min-h-full">
        <Shell initialAccent={DEFAULT_ACCENT}>{children}</Shell>
      </body>
    </html>
  );
}
