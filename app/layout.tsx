import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Valtrix Capital — Web3 Trading & Yield",
    template: "%s · Valtrix Capital",
  },
  description:
    "Stake on-chain. Trade live markets. Earn up to 1% daily with a 7-level referral network — all on BNB Chain and Polygon.",
  applicationName: "Valtrix Capital",
  authors: [{ name: "Valtrix Capital" }],
  keywords: [
    "Valtrix",
    "Web3",
    "trading",
    "staking",
    "BEP20",
    "BNB Chain",
    "Polygon",
    "DeFi",
    "yield",
  ],
  openGraph: {
    title: "Valtrix Capital",
    description:
      "Stake on-chain. Trade live markets. Earn up to 1% daily on BNB Chain & Polygon.",
    url: "/",
    siteName: "Valtrix Capital",
    type: "website",
  },
  icons: {
    icon: "/brand/valtrix-logo.png",
    shortcut: "/brand/valtrix-logo.png",
    apple: "/brand/valtrix-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} ${jetbrains.variable} dark`}
    >
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "hsl(228 14% 13%)",
              border: "1px solid hsl(228 11% 16%)",
              color: "hsl(240 14% 96%)",
            },
          }}
        />
      </body>
    </html>
  );
}
