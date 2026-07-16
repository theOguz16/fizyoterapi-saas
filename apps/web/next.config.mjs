const clinicImageOrigins = [
  process.env.NEXT_PUBLIC_API_BASE,
  ...(process.env.NEXT_PUBLIC_CLINIC_IMAGE_ORIGINS || "").split(","),
  "https://api.fizyoflow.com",
  "http://localhost:4949",
  "https://images.unsplash.com",
  "https://dummyimage.com",
].filter(Boolean);

const remotePatterns = Array.from(new Set(clinicImageOrigins.map((value) => {
  try {
    const url = new URL(value.trim());
    return JSON.stringify({ protocol: url.protocol.replace(":", ""), hostname: url.hostname, port: url.port, pathname: "/**" });
  } catch {
    return "";
  }
}).filter(Boolean))).map((value) => JSON.parse(value));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/product-screens/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
