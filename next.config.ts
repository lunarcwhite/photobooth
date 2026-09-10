import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone testing via ngrok HTTPS tunnel (camera needs secure context).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io"],
};

export default nextConfig;
