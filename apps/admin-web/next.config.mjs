/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const apiBase = process.env.NEXT_PUBLIC_API_URL;

function buildConnectSources() {
  const sources = new Set(["'self'"]);

  if (apiBase) {
    try {
      sources.add(new URL(apiBase).origin);
    } catch {
      // Ignore malformed values here; the runtime layer fails fast with a clearer error.
    }
  }

  if (isDev) {
    sources.add("http://localhost:4949");
    sources.add("http://127.0.0.1:4949");
    sources.add("ws://localhost:2929");
    sources.add("ws://127.0.0.1:2929");
  }

  return Array.from(sources).join(" ");
}

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "object-src 'none'",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      `connect-src ${buildConnectSources()}`,
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
