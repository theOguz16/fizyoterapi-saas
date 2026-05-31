import type { Metadata } from "next";
import { JoinRedirectClient } from "./join-redirect-client";

type SalonJoinPageProps = {
  params: { salonSlug: string };
  searchParams?: { code?: string };
};

export const metadata: Metadata = {
  title: "Fizyoflow uygulamasına yönlendiriliyorsunuz",
  description: "Fizyoflow klinik daveti uygulama açılış ekranı.",
  robots: {
    index: false,
    follow: false,
  },
};

function getDeepLink(salonSlug: string) {
  return `fizyoflow://(intake-member)/salons/${encodeURIComponent(salonSlug)}`;
}

export default function SalonJoinPage({ params, searchParams }: SalonJoinPageProps) {
  const salonSlug = String(params.salonSlug || "").trim();
  const salonCode = String(searchParams?.code || "").trim();
  const deepLink = getDeepLink(salonSlug);
  const iosStoreUrl =
    process.env.NEXT_PUBLIC_IOS_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() ||
    deepLink;
  const androidStoreUrl =
    process.env.NEXT_PUBLIC_ANDROID_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() ||
    deepLink;

  return (
    <JoinRedirectClient
      salonSlug={salonSlug}
      salonCode={salonCode}
      deepLink={deepLink}
      iosStoreUrl={iosStoreUrl}
      androidStoreUrl={androidStoreUrl}
    />
  );
}
