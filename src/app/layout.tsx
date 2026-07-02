import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const SITE_URL = process.env.APP_URL || "http://localhost:3000";
const TITLE = "Remote Classroom — a real desktop for every student";
const DESCRIPTION =
  "Give every student a real Linux or Windows desktop in the browser. Cloud desktops for classrooms, powered by Daytona — no matter what device they have.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Remote Classroom",
  },
  description: DESCRIPTION,
  keywords: [
    "remote classroom",
    "cloud desktop",
    "virtual desktop for students",
    "Chromebook Linux desktop",
    "Chromebook Windows desktop",
    "Daytona",
    "classroom management",
  ],
  applicationName: "Remote Classroom",
  // manifest.ts and icon.tsx/apple-icon.tsx/opengraph-image.tsx are wired up
  // automatically via Next's file conventions — no need to repeat them here.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Remote Classroom",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
