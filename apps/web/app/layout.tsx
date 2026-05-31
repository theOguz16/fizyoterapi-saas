import type { Metadata } from "next";
import type { Viewport } from "next";
import { SiteAnalytics } from "../components/site-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fizyoflow | Fizyoterapi Klinikleri İçin Dijital Klinik Altyapısı",
  description: "Fizyoflow; klinik operasyonu, mobil uygulama, dijital vitrin, SEO ve lead toplama altyapısını tek platformda birleştirir.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com"),
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Fizyoflow | Fizyoterapi Klinikleri İçin Dijital Klinik Altyapısı",
    description: "Mobil klinik yönetimi, public klinik vitrini, SEO, Maps ve lead toplama altyapısı.",
    url: "https://fizyoflow.com",
    siteName: "Fizyoflow",
    type: "website",
    images: [
      {
        url: "/brand/fizyoflow-og.svg",
        width: 1200,
        height: 630,
        alt: "Fizyoflow dijital klinik altyapısı",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fizyoflow | Dijital Klinik Altyapısı",
    description: "Mobil operasyon, public klinik vitrini, SEO ve lead toplama altyapısı.",
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
