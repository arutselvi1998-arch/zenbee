import type { NextConfig } from 'next';

const nextConfig: NextConfig = { devIndicators: false, distDir: process.env.ZENBEE_NEXT_OUTPUT || '.next' };
export default nextConfig;
