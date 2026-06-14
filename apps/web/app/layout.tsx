import type { Metadata } from "next";
import type { Viewport } from "next";
import { SiteAnalytics } from "../components/site-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fizyoflow | Fizyoterapi Klinikleri İçin Mobil Yönetim Sistemi",
  description: "Fizyoflow; fizyoterapi klinikleri için seans takibi, paket takibi, check-in, ekip yönetimi, ölçüm ve danışan takibini tek mobil akışta toplar.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com"),
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Fizyoflow | Fizyoterapi Klinikleri İçin Mobil Yönetim Sistemi",
    description: "Seans takibi, paket takibi, check-in, ölçüm ve danışan takibini yönetici, fizyoterapist ve danışan ekranlarında birleştiren mobil sistem.",
    url: "https://fizyoflow.com",
    siteName: "Fizyoflow",
    type: "website",
    images: [
      {
        url: "/brand/fizyoflow-og.svg",
        width: 1200,
        height: 630,
        alt: "Fizyoflow mobil klinik yönetim sistemi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fizyoflow | Mobil Klinik Yönetimi",
    description: "Fizyoterapi klinikleri için seans, paket, check-in, ekip ve danışan takibini tek akışta toplayan mobil sistem.",
    images: ["/brand/fizyoflow-og.svg"],
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
