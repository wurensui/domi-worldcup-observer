/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  output: "export",
  reactStrictMode: true
};

export default nextConfig;
