import type { SessionRole } from "./session";

export type PushDeepLinkHref =
  | "/(admin)/approvals"
  | "/(admin)/calendar"
  | "/(admin)/subscription"
  | "/(trainer)/bookings"
  | "/(trainer)/calendar"
  | "/(trainer)/checkin"
  | `/(trainer)/checkin?${string}`
  | "/(trainer)/group-classes"
  | "/(member)/attendance"
  | "/(member)/bookings"
  | "/(member)/calendar"
  | "/(member)/campaigns"
  | "/(member)/group-classes"
  | "/(member)/home"
  | "/(member)/package"
  | "/(member)/referrals"
  | `/(auth)/invite-accept${string}`;

export type PushNotificationData = {
  href: PushDeepLinkHref;
  role: SessionRole;
  tenant_slug: string;
  type: string;
  [key: string]: unknown;
};
