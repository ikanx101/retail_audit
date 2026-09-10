import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { OnlineStatusBar } from "@/components/online-status-bar";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { AppFooter } from "@/components/app-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Retail Audit Sachet",
  description: "Webapps retail audit minuman sachet — warung kopi & toko kelontong",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Retail Audit",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased bg-slate-50 text-slate-900`}
      >
        <Providers>
          <ServiceWorkerRegister />
          <OnlineStatusBar />
          <div className="flex flex-1 flex-col">{children}</div>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
