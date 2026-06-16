const START_EVENT = "valtrix:navigation-start";

/** Notify the global route progress bar (e.g. before router.push). */
export function startNavigationProgress(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(START_EVENT));
}

export function onNavigationProgressStart(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(START_EVENT, listener);
  return () => window.removeEventListener(START_EVENT, listener);
}
