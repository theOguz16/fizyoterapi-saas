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
  },
  twitter: {
    title: content.metaTitle,
    description: content.metaDescription,
  },
};

export default function Page() {
  return <SeoLanding content={content} />;
}
