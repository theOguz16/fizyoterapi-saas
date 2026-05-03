type ReferralStatus = "INVITED" | "CONVERTED" | "REWARDED" | "CANCELED";

export function referralStatusLabel(status: ReferralStatus) {
  if (status === "INVITED") return "Davet Edildi";
  if (status === "CONVERTED") return "Kayıt Tamamlandı";
  if (status === "REWARDED") return "Ödül Aktarıldı";
  return "İptal";
}

export function buildReferralMetrics(referrals: Array<{ status: ReferralStatus }>, rewards: unknown[]) {
  return {
    total: referrals.length,
    converted: referrals.filter((row) => row.status === "CONVERTED").length,
    rewarded: referrals.filter((row) => row.status === "REWARDED").length,
    rewardMovements: rewards.length,
  };
}
