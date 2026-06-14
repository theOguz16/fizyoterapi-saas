import type { MetadataRoute } from "next";

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
    ],
    sitemap: `${WEB_BASE.replace(/\/$/, "")}/sitemap.xml`,
  };
}
