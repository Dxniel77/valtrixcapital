"use client";

import * as React from "react";

/** True when the browser tab is visible — pauses background polling when hidden. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = React.useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  React.useEffect(() => {
    const onChange = () =>
      setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
