/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@browserbasehq/stagehand', 'exa-js'],
  },
  serverExternalPackages: ['@browserbasehq/stagehand', 'exa-js'],
};

export default nextConfig;
