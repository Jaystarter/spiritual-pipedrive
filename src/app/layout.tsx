import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

import { SkyConstellations } from "@/components/sky-constellations";

const cinzel = Cinzel({
  variable: "--font-wordmark",
  weight: ["700"],
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "S-Drive — Bible Study CRM",
  description:
    "An illuminated ledger for the journey from first contact to baptism.",
};

// Runs synchronously before hydration so the saved theme is applied before
// first paint, preventing a flash of the wrong theme on reload. Handles the
// light (no attribute), dark, and star modes. A ?theme= query param acts as
// a non persisting override for previews and screenshots.
const themeBootstrapScript = `(function(){try{var m=location.search.match(/[?&]theme=(light|dark|star)/);var t=m?m[1]:localStorage.getItem('sd-theme');if(t==='dark'||t==='star'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The theme bootstrap script mutates data-theme before hydration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${cinzel.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <div aria-hidden className="sky-bg">
          <SkyConstellations />
        </div>
      </body>
    </html>
  );
}
