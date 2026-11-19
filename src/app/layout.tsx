import type { Metadata } from "next";
import { Fraunces, Albert_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { LiveFeedProvider } from "@/components/goldprism/LiveFeedProvider";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${albertSans.variable} ${fraunces.variable} ${plexMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LiveFeedProvider>
            {children}
            <Toaster />
          </LiveFeedProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
