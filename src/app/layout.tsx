import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoldPrism — Prism That Explains Scattered Gold | Team ARCEUS",
  description:
    "Quantitative Commodity Derivatives Intelligence platform for MCX Gold Spreads by Team ARCEUS (Hack in Hills '26 Track 03). Separate real economic value from expiry carry, settlement artifacts and transaction costs.",
  keywords: [
    "GoldPrism",
    "MCX Gold",
    "Commodity Derivatives",
    "Quantitative Finance",
    "Spread Decomposition",
    "X-Ray Waterfall",
    "Pawan Singh",
    "Team ARCEUS",
    "Hack in Hills 26",
    "Alpha Zoo",
    "Paper Trading",
  ],
  authors: [{ name: "Pawan Singh", url: "https://github.com/pawan00207" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "GoldPrism — Prism That Explains Scattered Gold | Team ARCEUS",
    description:
      "The only tool that tells you when NOT to trade, and proves it. Auditable MCX gold calendar spread research terminal.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
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
