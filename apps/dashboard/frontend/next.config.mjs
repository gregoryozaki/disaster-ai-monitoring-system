/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@kamara/shared-types'],
};

export default nextConfig;
