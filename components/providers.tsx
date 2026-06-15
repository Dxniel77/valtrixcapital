"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { LocaleProvider, useRainbowKitLocale } from "@/lib/i18n/context";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReferralCapture } from "@/components/referrals/referral-capture";

function buildRainbowTheme(mode: "light" | "dark"): Theme {
  const base =
    mode === "dark"
      ? darkTheme({
          accentColor: "#D4AF37",
          accentColorForeground: "#0A0A0F",
          borderRadius: "medium",
          overlayBlur: "small",
          fontStack: "system",
        })
      : lightTheme({
          accentColor: "#B58A2E",
          accentColorForeground: "#FFFFFF",
          borderRadius: "medium",
          overlayBlur: "small",
          fontStack: "system",
        });

  if (mode === "dark") {
    return {
      ...base,
      colors: {
        ...base.colors,
        modalBackground: "#11131A",
        modalBorder: "#23262F",
        modalText: "#F5F5F7",
        modalTextSecondary: "#9CA0AB",
        profileForeground: "#11131A",
        closeButtonBackground: "#1A1D27",
      },
    };
  }

  return {
    ...base,
    colors: {
      ...base.colors,
      modalBackground: "#FFFFFF",
      modalBorder: "#E2E8F0",
      modalText: "#0F172A",
      modalTextSecondary: "#64748B",
      profileForeground: "#FFFFFF",
      closeButtonBackground: "#F1F5F9",
    },
  };
}

function RainbowKitThemed({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const rainbowLocale = useRainbowKitLocale();
  const mode = resolvedTheme === "light" ? "light" : "dark";
  const theme = React.useMemo(() => buildRainbowTheme(mode), [mode]);

  return (
    <RainbowKitProvider
      theme={theme}
      modalSize="compact"
      locale={rainbowLocale}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <RainbowKitThemed>
              <React.Suspense fallback={null}>
                <ReferralCapture />
              </React.Suspense>
              {children}
            </RainbowKitThemed>
          </LocaleProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
