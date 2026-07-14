import type { Metadata } from "next";
import { resolveJoinRedirect } from "../../../lib/join-redirect";
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

export default function SalonJoinPage({ params, searchParams }: SalonJoinPageProps) {
  const salonCode = String(searchParams?.code || "").trim();
  const { salonSlug, deepLink, iosStoreUrl, androidStoreUrl } = resolveJoinRedirect({
    salonSlug: params.salonSlug,
    iosStoreUrl: process.env.NEXT_PUBLIC_IOS_APP_URL || process.env.NEXT_PUBLIC_APP_STORE_URL,
    androidStoreUrl: process.env.NEXT_PUBLIC_ANDROID_APP_URL || process.env.NEXT_PUBLIC_PLAY_STORE_URL,
  });

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
