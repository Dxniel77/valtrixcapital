/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Vercel production build uses webpack; transpile ESM wallet deps.
  transpilePackages: [
    "@rainbow-me/rainbowkit",
    "wagmi",
    "@wagmi/core",
    "@wagmi/connectors",
  ],
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
