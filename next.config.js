/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    turbo: false
  },
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right'
  },
  eslint: {
    // Disable ESLint during builds for production
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip type checking during builds for production  
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false
};

export default nextConfig;