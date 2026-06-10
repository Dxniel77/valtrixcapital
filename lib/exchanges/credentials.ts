/** Server-only exchange credentials (never import from client components). */

export function getBinanceCredentials() {
  return {
    apiKey: process.env.BINANCE_API_KEY?.trim() ?? "",
    apiSecret: process.env.BINANCE_API_SECRET?.trim() ?? "",
  };
}

export function getBybitCredentials() {
  return {
    apiKey: process.env.BYBIT_API_KEY?.trim() ?? "",
    apiSecret: process.env.BYBIT_API_SECRET?.trim() ?? "",
  };
}
