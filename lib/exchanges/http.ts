/** Shared fetch for server-side exchange proxies (Vercel-friendly timeouts + UA). */

export async function exchangeFetch(
  url: string,
  headers: HeadersInit = {},
  timeoutMs = 12_000,
): Promise<Response> {
  return fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "ValtrixCapital/1.0",
      Accept: "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
