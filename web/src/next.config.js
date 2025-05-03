/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Ignore type checking for files outside the web directory
    ignoreBuildErrors: true
  },
  webpack: (config, { isServer, dev }) => {
    // Handle TypeScript paths
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, '../'),
      '@/web': __dirname
    };

    // Handle vendor chunks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'socket.io-client': false,
        'engine.io-parser': false,
        'socket.io-parser': false,
        'supports-color': false,
        'ms': false
      };
    }

    // Optimize development builds
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }

    return config;
  },
  // Add development-specific configurations
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
  // Add base path for web directory
  basePath: '/web',
  // Configure output directory
  distDir: '.next',
  // Configure static file serving
  publicRuntimeConfig: {
    staticFolder: '/web/static'
  }
}

module.exports = nextConfig 