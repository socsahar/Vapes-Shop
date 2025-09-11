/** @type {import('next').NextConfig} */
const nextConfig = {
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