import { ScrollDepthTracker, SectionViewTracker, SiteEventTracker } from "../public-event";
import { CLINIC_API_BASE, buildClinicProfileViewModel, type SalonPageData } from "../../lib/clinic-profile";
import { ClinicClosingActions } from "./actions";
import { ClinicContactSection, ClinicLocationAndGallery, ClinicMessageAndVisibility, ClinicServicesSection } from "./details";
import { ClinicHero } from "./hero";

export function ClinicProfilePage({ data }: { data: SalonPageData }) {
  const model = buildClinicProfileViewModel(data);
  return (
    <main>
      <SiteEventTracker apiBase={CLINIC_API_BASE} slug={data.slug} />
      <ScrollDepthTracker apiBase={CLINIC_API_BASE} slug={data.slug} />
      <SectionViewTracker apiBase={CLINIC_API_BASE} slug={data.slug} sections={["contact", "services", "location", "gallery", "final-cta"]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(model.jsonLd) }} />
      <ClinicHero model={model} />
      <ClinicContactSection model={model} />
      <ClinicMessageAndVisibility model={model} />
      <ClinicServicesSection model={model} />
      <ClinicLocationAndGallery model={model} />
      <ClinicClosingActions model={model} />
    </main>
  );
}
