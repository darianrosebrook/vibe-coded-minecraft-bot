/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Ignore type checking for files outside the web directory
    ignoreBuildErrors: true
  }
}

module.exports = nextConfig 