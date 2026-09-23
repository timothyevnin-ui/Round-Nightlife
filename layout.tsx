import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { SignInSheet } from "@/components/SignInSheet";

const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const instrument = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "ROUND", template: "%s · ROUND" },
  description: "Where should we go tonight? Tell ROUND the kind of night, get three great places in NYC, pick one, go.",
  applicationName: "ROUND",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ROUND",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    siteName: "ROUND",
    type: "website",
    title: "ROUND",
    description: "Where should we go tonight?",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3ede0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <SignInSheet />
        </AuthProvider>
      </body>
    </html>
  );
}
