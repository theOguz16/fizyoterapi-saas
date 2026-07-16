const PRODUCT_EVENT_NAMES = [
  "app_opened",
  "clinic_signup_started",
  "clinic_created",
  "trial_started",
  "package_created",
  "working_hours_saved",
  "clinic_qr_viewed",
  "member_invite_started",
  "subscription_viewed",
  "purchase_started",
];

const PUBLIC_PRODUCT_EVENT_NAMES = ["app_opened", "clinic_signup_started"];
const AUTHENTICATED_PRODUCT_EVENT_NAMES = [
  "clinic_qr_viewed",
  "member_invite_started",
  "subscription_viewed",
  "purchase_started",
];
const BACKEND_PRODUCT_EVENT_NAMES = [
  "clinic_created",
  "trial_started",
  "package_created",
  "working_hours_saved",
];

module.exports = {
  PRODUCT_EVENT_NAMES,
  PUBLIC_PRODUCT_EVENT_NAMES,
  AUTHENTICATED_PRODUCT_EVENT_NAMES,
  BACKEND_PRODUCT_EVENT_NAMES,
};
