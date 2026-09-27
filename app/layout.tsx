import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import "./globals.css";

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
    "A personalized world of fine art: museum masterpieces, contemporary work, and meaningful visual discovery.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${interfaceFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
