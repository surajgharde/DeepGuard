/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Artefact images are served by the FastAPI backend and rendered with plain
  // <img> tags, so no next/image remote-pattern config is needed here.
};

export default nextConfig;
