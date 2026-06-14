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
  },
  twitter: {
    title: content.metaTitle,
    description: content.metaDescription,
  },
};

export default function Page() {
  return <SeoLanding content={content} />;
}
