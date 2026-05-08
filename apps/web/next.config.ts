import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: 'https://civictrace-production.up.railway.app/api/v1',
  },
};

export default nextConfig;
