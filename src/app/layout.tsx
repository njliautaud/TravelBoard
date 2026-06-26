import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ApiPatchProvider from "@/components/ApiPatchProvider";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

// Force all pages to be server-rendered (not pre-rendered during build)
// because the Supabase Auth client needs runtime env vars.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TravelBoard",
  description: "Your personal travel map — wishlist, journal, deals & more",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "TravelBoard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistrar />
        <ApiPatchProvider>{children}</ApiPatchProvider>
      </body>
    </html>
  );
}
