/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
