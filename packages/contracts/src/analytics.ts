export {
  AUTHENTICATED_PRODUCT_EVENT_NAMES,
  BACKEND_PRODUCT_EVENT_NAMES,
  PRODUCT_EVENT_NAMES,
  PUBLIC_PRODUCT_EVENT_NAMES,
} from "./runtime";
import { PRODUCT_EVENT_NAMES } from "./runtime";

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export type ProductEventMetadataValue = string | number | boolean | null;

export type ProductEventPayload = {
  event_name: ProductEventName;
  event_id: string;
  occurred_at: string;
  install_id: string;
  session_id: string;
  funnel_id: string;
  metadata: Record<string, ProductEventMetadataValue>;
};

export type ProductFunnelStep = {
  event_name: ProductEventName;
  event_count: number;
  unique_funnels: number;
  unique_accounts: number;
  unique_tenants: number;
  conversion_from_previous_percent: number | null;
};

export type ProductFunnelReport = {
  from: string;
  to: string;
  tenant_id: string | null;
  steps: ProductFunnelStep[];
};
