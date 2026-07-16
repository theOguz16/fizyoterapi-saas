import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClinicProfilePage } from "../../components/clinic-profile/clinic-profile-page";
import { ClinicUnavailable } from "../../components/clinic-profile/unavailable";
import {
  buildClinicMetadata,
  buildUnavailableClinicMetadata,
  getClinicProfileResult,
  type ClinicPageProps,
} from "../../lib/clinic-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ClinicPageProps): Promise<Metadata> {
  const result = await getClinicProfileResult(params.salonSlug);
  if (result.status === "not_found") return { title: "Klinik bulunamadı | FizyoFlow", robots: { index: false, follow: false } };
  if (result.status === "unavailable") return buildUnavailableClinicMetadata(params.salonSlug);
  return buildClinicMetadata(result.data);
}

export default async function SalonPublicPage({ params }: ClinicPageProps) {
  const result = await getClinicProfileResult(params.salonSlug);
  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") return <ClinicUnavailable slug={params.salonSlug} />;
  return <ClinicProfilePage data={result.data} />;
}
