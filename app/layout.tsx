import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import "./globals.css";
import { AccountSession } from "@/components/auth/AccountSession";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const interfaceFont = Geist({
  subsets: ["latin"],
  variable: "--font-interface",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ARTE — Discover Art That Discovers You",
    template: "%s — ARTE",
  },
  description:
    "Explore ARTE's early-access art discovery demo. Find visual connections, build private collections, and discover your Art DNA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${interfaceFont.variable}`}>
        <a href="#main-content" className="focus-ring sr-only z-[100] bg-[var(--gallery-ivory)] p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
        <AccountSession>{children}</AccountSession>
      </body>
    </html>
  );
}
