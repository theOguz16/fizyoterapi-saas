import type { Metadata } from "next";
import { SeoLanding } from "../../components/seo-landing";
import { seoLandingPages } from "../seo-content";

const content = seoLandingPages["fizyoterapi-klinik-yonetim-sistemi"];

export const metadata: Metadata = {
  title: content.metaTitle,
  description: content.metaDescription,
  alternates: { canonical: "/fizyoterapi-klinik-yonetim-sistemi" },
  openGraph: {
    title: content.metaTitle,
    description: content.metaDescription,
    url: "/fizyoterapi-klinik-yonetim-sistemi",
    images: [{ url: content.image, width: 1206, height: 2622, alt: content.imageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metaTitle,
    description: content.metaDescription,
    images: [content.image],
  },
};

export default function Page() {
  return <SeoLanding content={content} />;
}
