import type { Metadata } from "next";
import { SeoLanding } from "../../components/seo-landing";
import { seoLandingPages } from "../seo-content";

const content = seoLandingPages["fizyoterapist-check-in"];

export const metadata: Metadata = {
  title: content.metaTitle,
  description: content.metaDescription,
  alternates: { canonical: "/fizyoterapist-check-in" },
  openGraph: {
    title: content.metaTitle,
    description: content.metaDescription,
    url: "/fizyoterapist-check-in",
  },
  twitter: {
    title: content.metaTitle,
    description: content.metaDescription,
  },
};

export default function Page() {
  return <SeoLanding content={content} />;
}
