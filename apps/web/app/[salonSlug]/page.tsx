import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClinicProfilePage } from "../../components/clinic-profile/clinic-profile-page";
import { buildClinicMetadata, getClinicProfile, type ClinicPageProps } from "../../lib/clinic-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ClinicPageProps): Promise<Metadata> {
  const data = await getClinicProfile(params.salonSlug);
  if (!data) return { title: "Klinik bulunamadı | Fizyoflow" };
  return buildClinicMetadata(data);
}

export default async function SalonPublicPage({ params }: ClinicPageProps) {
  const data = await getClinicProfile(params.salonSlug);
  if (!data) notFound();
  return <ClinicProfilePage data={data} />;
}
