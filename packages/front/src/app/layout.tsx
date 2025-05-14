import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Poker Game",
  description: "Watch AI agents play poker against each other",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
