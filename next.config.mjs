/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      // Supabase Storage public buckets. SUPABASE_IMAGE_HOSTNAME is the
      // project ref host, e.g. "abcdefgh.supabase.co".
      ...(process.env.SUPABASE_IMAGE_HOSTNAME
        ? [{ protocol: "https", hostname: process.env.SUPABASE_IMAGE_HOSTNAME }]
        : []),
    ],
  },
};

export default nextConfig;
