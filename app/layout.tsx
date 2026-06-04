import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { Providers } from "@/components/providers";
import { ThemedToaster } from "@/components/theme/themed-toaster";
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
    default: "Valtrix Capital — Trading Web3 y rendimiento",
    template: "%s · Valtrix Capital",
  },
  description:
    "Haz staking on-chain. Opera mercados en vivo. Gana hasta un 1% diario con una red de referidos de 7 niveles — en BNB Chain y Polygon.",
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
      "Haz staking on-chain. Opera mercados en vivo. Gana hasta un 1% diario en BNB Chain y Polygon.",
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
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
        <ThemedToaster />
      </body>
    </html>
  );
}
