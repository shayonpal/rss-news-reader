import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWAProvider } from "@/components/pwa-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { RecoveryProvider } from "@/components/migration/RecoveryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shayon's News",
  description:
    "A clean, fast, and intelligent RSS reader with AI-powered summaries",
  manifest: "/reader/manifest.json",
  icons: {
    icon: [
      { url: "/reader/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/reader/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/reader/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shayon's News",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#FF6B35" },
      { media: "(prefers-color-scheme: dark)", color: "#FF6B35" },
    ],
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <PWAProvider />
        <ThemeProvider />
        <RecoveryProvider>
          <div id="root">{children}</div>
        </RecoveryProvider>
      </body>
    </html>
  );
}
