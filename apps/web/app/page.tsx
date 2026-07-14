import type { Metadata } from "next";
import { buildHomeJsonLd } from "../components/home-page/content";
import {
  ComparisonSection,
  DemoSection,
  FaqSection,
  HomeFooter,
  HomeHero,
  HomeIntroAndNavigation,
  OperationalFlowSection,
  ProductExplanationSection,
  ProductScreensSection,
  TrustSection,
} from "../components/home-page/sections";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main className="product-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeJsonLd()) }} />
      <HomeIntroAndNavigation />
      <HomeHero />
      <ProductExplanationSection />
      <ComparisonSection />
      <OperationalFlowSection />
      <ProductScreensSection />
      <TrustSection />
      <FaqSection />
      <DemoSection />
      <HomeFooter />
    </main>
  );
}
