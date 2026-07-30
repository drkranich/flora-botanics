/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // @flora/db e @flora/core são pacotes do monorepo — resolvidos em runtime.
    // O typecheck completo roda via `tsc --noEmit` separado no CI.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // Supabase Storage (logos, fotos de produtos, media do CMS)
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      // Supabase Storage via CDN
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
    ],
  },
};

export default nextConfig;
