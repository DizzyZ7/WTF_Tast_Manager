/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@wtf/ui"],
};

export default nextConfig;
