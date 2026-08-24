import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import DemoModeBanner from "@/components/DemoModeBanner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Internet Wars — Indian Stock Market vs Forex Market",
  description:
    "Pick your side in the live Indian Stock Market vs Forex Market community battle. Watch the scoreboard, support your community and compete for #1.",
  openGraph: {
    title: "Internet Wars — Indian Stock Market vs Forex Market",
    description: "Pick your side. Support your community. Move the scoreboard.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Internet Wars — Indian Stock Market vs Forex Market",
    description: "Pick your side. Support your community. Move the scoreboard.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <DemoModeBanner />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
