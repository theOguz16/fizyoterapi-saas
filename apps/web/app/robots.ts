import type { MetadataRoute } from "next";

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/_next/"],
    },
    sitemap: `${WEB_BASE.replace(/\/$/, "")}/sitemap.xml`,
  };
}
