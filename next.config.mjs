/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io", pathname: `/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "ez6qtt5k"}/${process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production"}/**` }] },
};

export default nextConfig;
