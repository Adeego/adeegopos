// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  webpack: (config, { isServer }) => {
    // Exclude Realm from webpack bundling
    config.externals.push('realm');

    if (!isServer) {
      // Make sure Realm is not included in the client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        realm: false,
      };
    }

    return config;
  },
}

export default nextConfig;