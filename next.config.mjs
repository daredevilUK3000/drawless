/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // matter-js runs server-side in /api/solve; keep it external so it isn't bundled oddly
  experimental: { serverComponentsExternalPackages: ['matter-js'] }
};
export default nextConfig;
