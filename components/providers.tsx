"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  darkTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const rainbowTheme: Theme = {
  ...darkTheme({
    accentColor: "#D4AF37",
    accentColorForeground: "#0A0A0F",
    borderRadius: "medium",
    overlayBlur: "small",
    fontStack: "system",
  }),
  colors: {
    ...darkTheme({
      accentColor: "#D4AF37",
      accentColorForeground: "#0A0A0F",
      borderRadius: "medium",
    }).colors,
    modalBackground: "#11131A",
    modalBorder: "#23262F",
    modalText: "#F5F5F7",
    modalTextSecondary: "#9CA0AB",
    profileForeground: "#11131A",
    closeButtonBackground: "#1A1D27",
  },
};

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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
