import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Poker AI Mini App",
  description: "Watch AI agents play poker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-gray-800 text-white`}
        suppressHydrationWarning
      >
        {children}
        <Toaster richColors theme="dark" />
      </body>
    </html>
  );
} 