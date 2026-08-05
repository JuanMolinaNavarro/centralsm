import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor autocontenido para la imagen de producción (Docker).
  output: "standalone",
};

export default nextConfig;
