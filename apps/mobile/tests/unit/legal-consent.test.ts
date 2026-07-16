import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENT_VERSION } from "@fitnes-saas/contracts";
import {
  createRegistrationLegalConsent,
  EMPTY_LEGAL_CONSENT_SELECTION,
  getLegalConsentValidationMessage,
} from "@/lib/legal-consent";

describe("registration legal consent", () => {
  it("starts every declaration unchecked", () => {
    expect(EMPTY_LEGAL_CONSENT_SELECTION).toEqual({
      termsAccepted: false,
      privacyNoticeAcknowledged: false,
      marketingConsent: false,
    });
  });

  it("requires terms and notice acknowledgement but not marketing", () => {
    expect(getLegalConsentValidationMessage(EMPTY_LEGAL_CONSENT_SELECTION)).toContain("Kullanım Şartları");
    expect(getLegalConsentValidationMessage({
      ...EMPTY_LEGAL_CONSENT_SELECTION,
      termsAccepted: true,
    })).toContain("KVKK Aydınlatma Metni");
    expect(getLegalConsentValidationMessage({
      ...EMPTY_LEGAL_CONSENT_SELECTION,
      termsAccepted: true,
      privacyNoticeAcknowledged: true,
    })).toBeNull();
  });

  it("builds a versioned API payload and preserves optional marketing choice", () => {
    expect(createRegistrationLegalConsent({
      termsAccepted: true,
      privacyNoticeAcknowledged: true,
      marketingConsent: true,
    })).toEqual({
      terms_accepted: true,
      privacy_notice_acknowledged: true,
      marketing_consent: true,
      document_version: LEGAL_DOCUMENT_VERSION,
    });
  });
});
