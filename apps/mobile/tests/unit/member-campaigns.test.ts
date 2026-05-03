import { describe, expect, it } from "vitest";
import { buildCampaignSummary } from "@/lib/member-campaigns";

describe("member campaigns helpers", () => {
  it("builds campaign summaries with defaults", () => {
    expect(buildCampaignSummary(null, null)).toEqual({
      activeReferralCampaigns: 0,
      totalReferrals: 0,
      convertedReferrals: 0,
      rewardedReferrals: 0,
      activeLoyaltyCampaigns: 0,
      cancellationHours: 3,
    });
  });

  it("maps referral and loyalty campaign counts", () => {
    expect(
      buildCampaignSummary(
        {
          active_referral_campaigns: 2,
          active_loyalty_campaigns: 1,
          cancellation_policy: { min_hours_before_start: 6 },
        },
        {
          total: 7,
          converted: 3,
          rewarded: 2,
        }
      )
    ).toEqual({
      activeReferralCampaigns: 2,
      totalReferrals: 7,
      convertedReferrals: 3,
      rewardedReferrals: 2,
      activeLoyaltyCampaigns: 1,
      cancellationHours: 6,
    });
  });

  it("keeps zero and null values stable", () => {
    expect(
      buildCampaignSummary(
        {
          active_referral_campaigns: 0,
          active_loyalty_campaigns: null,
          cancellation_policy: { min_hours_before_start: 0 },
        },
        {
          total: 0,
          converted: null,
          rewarded: undefined,
        }
      )
    ).toEqual({
      activeReferralCampaigns: 0,
      totalReferrals: 0,
      convertedReferrals: 0,
      rewardedReferrals: 0,
      activeLoyaltyCampaigns: 0,
      cancellationHours: 0,
    });
  });
});
