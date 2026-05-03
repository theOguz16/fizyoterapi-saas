import { JoinRedirectClient } from "./join-redirect-client";

type SalonJoinPageProps = {
  params: { salonSlug: string };
  searchParams?: { code?: string };
};

function getDeepLink(salonSlug: string) {
  return `clinerva://(intake-member)/salons/${encodeURIComponent(salonSlug)}`;
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
