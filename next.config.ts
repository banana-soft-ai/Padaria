import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Suprimir avisos de console em produção
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Permitir build mesmo com avisos de lint enquanto refatoramos tipagens
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ignorar erros de TypeScript durante o build (temporário — resolver tipagens posteriormente)
  // Ativar validação de tipos em build — mantemos checagem forte (recomendado)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Configurações de produção para Railway
  output: 'standalone',

  // Configurações para PWA e offline
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
