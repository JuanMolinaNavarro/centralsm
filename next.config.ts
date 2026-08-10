import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor autocontenido para la imagen de producción (Docker).
  output: "standalone",
  async redirects() {
    // Los módulos Productos y Teamplace se unificaron dentro de Catálogo.
    return [
      { source: "/productos", destination: "/catalogo/altas", permanent: false },
      { source: "/productos/nuevo", destination: "/catalogo/altas/nuevo", permanent: false },
      { source: "/teamplace", destination: "/catalogo", permanent: false },
    ];
  },
};

export default nextConfig;
