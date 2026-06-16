import type { Metadata } from "next";
import { SeoLanding } from "../../components/seo-landing";
import { seoLandingPages } from "../seo-content";

const content = seoLandingPages["danisan-takibi-olcum"];

export const metadata: Metadata = {
  title: content.metaTitle,
  description: content.metaDescription,
  alternates: { canonical: "/danisan-takibi-olcum" },
  openGraph: {
    title: content.metaTitle,
    description: content.metaDescription,
    url: "/danisan-takibi-olcum",
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
