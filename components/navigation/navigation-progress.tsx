"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { onNavigationProgressStart } from "@/lib/navigation/progress-events";
import { cn } from "@/lib/utils";

function isSameRoute(url: URL, current: URL): boolean {
  return url.pathname === current.pathname && url.search === current.search;
}

function shouldStartFromClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  return !isSameRoute(url, new URL(window.location.href));
}

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [visible, setVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const trickleRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const completeRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRouteKey = React.useRef(routeKey);
  const isFirstRender = React.useRef(true);

  const clearTimers = React.useCallback(() => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    if (completeRef.current) clearTimeout(completeRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    trickleRef.current = null;
    completeRef.current = null;
    hideRef.current = null;
  }, []);

  const start = React.useCallback(() => {
    clearTimers();
    setVisible(true);
    setProgress(10);

    trickleRef.current = setInterval(() => {
      setProgress((value) => {
        if (value >= 90) return value;
        const step = (92 - value) * 0.1 + Math.random() * 6;
        return Math.min(value + step, 90);
      });
    }, 180);
  }, [clearTimers]);

  const complete = React.useCallback(() => {
    clearTimers();
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
  }, [clearTimers]);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevRouteKey.current = routeKey;
      return;
    }

    if (prevRouteKey.current !== routeKey) {
      prevRouteKey.current = routeKey;
      complete();
    }
  }, [routeKey, complete]);

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a");
      if (!anchor || !shouldStartFromClick(event, anchor)) return;
      start();
    };

    const onPopState = () => start();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  React.useEffect(() => onNavigationProgressStart(start), [start]);

  React.useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[10000]",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="relative h-[3px] w-full bg-gold/10">
        <div
          className={cn(
            "navigation-progress-bar absolute inset-y-0 left-0",
            "bg-gold-gradient shadow-gold-glow",
            progress >= 100 ? "duration-200" : "duration-300",
          )}
          style={{ width: `${Math.max(progress, 4)}%` }}
        />
        {visible && progress < 100 ? (
          <div
            className="navigation-progress-shimmer absolute inset-y-0 w-24"
            style={{ left: `${Math.max(progress - 8, 0)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function NavigationProgress() {
  return (
    <React.Suspense fallback={null}>
      <NavigationProgressBar />
    </React.Suspense>
  );
}
