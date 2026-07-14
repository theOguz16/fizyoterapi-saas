import type { WorkingHours } from "./working-hours";

export type PublicClinicService = {
  title?: string | null;
  desc?: string | null;
  summary?: string | null;
  starting_price?: string | number | null;
  display_price?: string | number | null;
  type?: string | null;
  active_member_count?: number | null;
};

export type PublicTrainerOption = {
  id: string;
  full_name: string;
  specialties?: string[];
  bio?: string | null;
  rating_label?: string | null;
  compatibility_note?: string | null;
  avatar_label?: string | null;
  matching_slots?: number | null;
  required_matching_slots?: number | null;
  is_available?: boolean;
  membership_id?: string | null;
  member_id?: string | null;
  member_full_name?: string | null;
};

export type ClinicSummary = {
  id: string;
  slug: string;
  name: string;
  tenant_id?: string;
  tenant_name?: string | null;
  city?: string | null;
  district?: string | null;
  location?: { city?: string | null; district?: string | null } | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  primary_color?: string | null;
  about_text?: string | null;
  is_boosted?: boolean;
  boost_label?: string | null;
  services?: PublicClinicService[];
  trainers?: PublicTrainerOption[];
  business_hours?: WorkingHours | null;
};

export type PublicClinicProfile = {
  id: string;
  name: string;
  slug: string;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  google_business_url?: string | null;
  google_maps_url?: string | null;
  business_category?: string | null;
  service_area?: string[];
  managed_growth_status?: string;
  digital_brief?: {
    logo_url?: string;
    gallery_urls?: string[];
    working_hours_note?: string;
    review_url?: string;
    campaign_note?: string;
    target_audience?: string;
    brand_voice?: string;
  };
  about_text?: string | null;
  why_us?: Array<{ title?: string; desc?: string }>;
  services?: PublicClinicService[];
  location?: {
    city?: string;
    district?: string;
    phone?: string;
    address?: string;
    maps_embed_url?: string;
    [key: string]: unknown;
  };
  social_links?: { instagram?: string; website?: string; whatsapp?: string };
  theme?: string;
  primary_color?: string;
  business_hours?: WorkingHours;
  city?: string | null;
  district?: string | null;
  campaigns?: Record<string, unknown>;
  gallery_images?: Array<{
    id: string;
    url: string;
    type?: string;
    sort_order?: number;
    meta?: Record<string, unknown>;
  }>;
};
