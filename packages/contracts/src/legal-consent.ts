export const LEGAL_DOCUMENT_VERSION = "2026-07-16";

export type RegistrationLegalConsent = {
  terms_accepted: boolean;
  privacy_notice_acknowledged: boolean;
  marketing_consent: boolean;
  document_version: string;
};

export type StoredRegistrationLegalConsent = {
  terms: {
    accepted_at: string;
    version: string;
  };
  privacy_notice: {
    acknowledged_at: string;
    version: string;
  };
  marketing: {
    granted: boolean;
    updated_at: string;
    version: string;
  };
  source: "MOBILE_CLINIC_OWNER_REGISTER" | "MOBILE_CLINIC_MEMBER_REGISTER";
};
