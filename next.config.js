/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Externalize the Open Payments package so it runs from node_modules
  // This ensures YAML spec files are accessible
  serverComponentsExternalPackages: ['@interledger/open-payments'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle @interledger packages - use them from node_modules
      config.externals = config.externals || [];
      config.externals.push({
        '@interledger/open-payments': 'commonjs @interledger/open-payments',
        '@interledger/openapi': 'commonjs @interledger/openapi',
      });
    }
    return config;
  },
};

module.exports = nextConfig;

