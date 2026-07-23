export type SubscriptionSyncState = "IDLE" | "PENDING_SYNC" | "SYNCED" | "FAILED";
export type SubscriptionRecommendedAction = "WAIT_REVIEW" | "WAIT_SETUP" | "START_TRIAL" | "PURCHASE_IN_APP" | "MANAGE_PLAN";

export type AdminClinicSubscription = {
  tenant_id: string;
  review_status: string;
  subscription_status: string;
  is_public: boolean;
  trial_starts_at?: string | null;
  trial_ends_at?: string | null;
  subscription_started_at?: string | null;
  subscription_current_period_ends_at?: string | null;
  subscription_last_event_at?: string | null;
  trial_days_total: number;
  trial_days_remaining: number;
  has_trial_history: boolean;
  can_start_trial: boolean;
  can_purchase_in_app: boolean;
  has_billing_issue?: boolean;
  will_renew?: boolean;
  purchase_provider: "REVENUECAT";
  purchase_mode: "IN_APP_PURCHASE";
  recommended_action: SubscriptionRecommendedAction;
  sync_state?: SubscriptionSyncState;
  subscription_history_summary?: {
    last_event_type?: string | null;
    last_event_at?: string | null;
    product_id?: string | null;
    store?: string | null;
  } | null;
  store_products?: {
    provider?: "REVENUECAT" | string;
    monthly_product_id?: string | null;
    yearly_product_id?: string | null;
  } | null;
};
