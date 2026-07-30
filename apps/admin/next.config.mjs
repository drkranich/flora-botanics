/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: "/admin",
  typescript: {
    // @flora/core e @flora/db são pacotes do monorepo — resolvidos em runtime.
    // O typecheck completo roda via `tsc --noEmit` separado no CI.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
