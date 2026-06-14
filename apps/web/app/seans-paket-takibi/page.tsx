import type { Metadata } from "next";
import { SeoLanding } from "../../components/seo-landing";
import { seoLandingPages } from "../seo-content";

const content = seoLandingPages["seans-paket-takibi"];

export const metadata: Metadata = {
  title: content.metaTitle,
  description: content.metaDescription,
  alternates: { canonical: "/seans-paket-takibi" },
  openGraph: {
    title: content.metaTitle,
    description: content.metaDescription,
    url: "/seans-paket-takibi",
  },
  twitter: {
    title: content.metaTitle,
    description: content.metaDescription,
  },
};

export default function Page() {
  return <SeoLanding content={content} />;
}
