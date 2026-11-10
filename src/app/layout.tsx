import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoldPrism — Prism That Explains Scattered Gold",
  description:
    "Quantitative research terminal for MCX gold spreads. Separate real economic value from expiry carry, settlement artifacts and transaction costs.",
  keywords: [
    "GoldPrism",
    "MCX Gold",
    "Commodity Derivatives",
    "Quantitative Finance",
    "Spread Decomposition",
    "X-Ray Waterfall",
    "Alpha Zoo",
    "Paper Trading",
  ],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "GoldPrism — Prism That Explains Scattered Gold",
    description: "Auditable MCX gold calendar spread research terminal.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GoldPrism — Prism That Explains Scattered Gold",
    description:
      "Separate real economic value from expiry carry, settlement artifacts and transaction costs — then make a disciplined decision.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
