import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dash-focused.vercel.app"),
  title: "Three — Spending, Tasks, Workouts",
  description: "A focused personal dashboard for the three things that matter.",
  openGraph: {
    title: "Three — Spending, Tasks, Workouts",
    description: "A focused personal dashboard for the three things that matter.",
    images: [{ url: "/three-social-preview.png", width: 1730, height: 909 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/three-social-preview.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
