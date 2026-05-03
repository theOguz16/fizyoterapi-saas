// Bu helper modulu mobil tarafta member campaigns ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type CampaignsLike = {
  active_referral_campaigns?: number | null;
  active_loyalty_campaigns?: number | null;
  cancellation_policy?: {
    min_hours_before_start?: number | null;
  } | null;
} | null;

type ReferralsLike = {
  total?: number | null;
  converted?: number | null;
  rewarded?: number | null;
} | null;

export function buildCampaignSummary(campaigns?: CampaignsLike, referrals?: ReferralsLike) {
  return {
    activeReferralCampaigns: campaigns?.active_referral_campaigns ?? 0,
    totalReferrals: referrals?.total ?? 0,
    convertedReferrals: referrals?.converted ?? 0,
    rewardedReferrals: referrals?.rewarded ?? 0,
    activeLoyaltyCampaigns: campaigns?.active_loyalty_campaigns ?? 0,
    cancellationHours: campaigns?.cancellation_policy?.min_hours_before_start ?? 3,
  };
}
