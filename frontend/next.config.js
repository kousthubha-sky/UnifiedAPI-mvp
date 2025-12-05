/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx'],
  swcMinify: true,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
