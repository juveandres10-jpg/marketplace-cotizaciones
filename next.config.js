/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Las fuentes de las piezas gráficas se leen del disco en las funciones.
    outputFileTracingIncludes: {
      "/api/mercadeo/**/*": ["./src/lib/mercadeo/fuentes/**/*"],
    },
  },
};

module.exports = nextConfig;
