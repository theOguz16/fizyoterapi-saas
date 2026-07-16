import type { Metadata } from "next";
import type { Viewport } from "next";
import { SiteAnalytics } from "../components/site-analytics";
import "./globals.css";

const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "";
const BING_SITE_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || "";

export const metadata: Metadata = {
  title: "FizyoFlow | Mobil Klinik Yönetim Platformu",
  description: "FizyoFlow; fizyoterapi ve pilates klinikleri için randevu, paket, danışan, uzman, QR ve gelir/seans takibini tek mobil yönetim platformunda toplar.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com"),
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "FizyoFlow | Mobil Klinik Yönetim Platformu",
    description: "Fizyoterapi ve pilates klinikleri için randevu, paket, danışan, uzman, QR ve gelir/seans takibini tek mobil akışta birleştiren yönetim platformu.",
    url: "https://fizyoflow.com",
    siteName: "FizyoFlow",
    type: "website",
    images: [
      {
        url: "/brand/fizyoflow-og.svg",
        width: 1200,
        height: 630,
        alt: "FizyoFlow mobil klinik yönetim sistemi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FizyoFlow | Mobil Klinik Yönetimi",
    description: "Fizyoterapi ve pilates klinikleri için randevu, paket, uzman, QR, danışan ve gelir/seans takibini tek akışta toplayan mobil yönetim platformu.",
    images: ["/brand/fizyoflow-og.svg"],
  },
  verification: {
    ...(GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : {}),
    ...(BING_SITE_VERIFICATION ? { other: { "msvalidate.01": [BING_SITE_VERIFICATION] } } : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#6f9274",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
