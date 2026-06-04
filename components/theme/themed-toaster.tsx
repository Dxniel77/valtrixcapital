"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";

  return (
    <Toaster
      position="top-right"
      theme={dark ? "dark" : "light"}
      toastOptions={{
        style: dark
          ? {
              background: "hsl(228 14% 13%)",
              border: "1px solid hsl(228 11% 16%)",
              color: "hsl(240 14% 96%)",
            }
          : {
              background: "hsl(0 0% 100%)",
              border: "1px solid hsl(220 13% 91%)",
              color: "hsl(222 47% 11%)",
            },
      }}
    />
  );
}
