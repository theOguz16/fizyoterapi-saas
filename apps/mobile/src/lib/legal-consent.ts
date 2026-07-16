import {
  LEGAL_DOCUMENT_VERSION,
  type RegistrationLegalConsent,
} from "@fitnes-saas/contracts";

export type LegalConsentSelection = {
  termsAccepted: boolean;
  privacyNoticeAcknowledged: boolean;
  marketingConsent: boolean;
};

export const EMPTY_LEGAL_CONSENT_SELECTION: LegalConsentSelection = {
  termsAccepted: false,
  privacyNoticeAcknowledged: false,
  marketingConsent: false,
};

export function getLegalConsentValidationMessage(selection: LegalConsentSelection) {
  if (!selection.termsAccepted) {
    return "Devam etmek için Kullanım Şartları'nı kabul etmelisin.";
  }
  if (!selection.privacyNoticeAcknowledged) {
    return "Devam etmek için KVKK Aydınlatma Metni'ni okuyup bilgi edindiğini belirtmelisin.";
  }
  return null;
}

export function createRegistrationLegalConsent(
  selection: LegalConsentSelection
): RegistrationLegalConsent {
  return {
    terms_accepted: selection.termsAccepted,
    privacy_notice_acknowledged: selection.privacyNoticeAcknowledged,
    marketing_consent: selection.marketingConsent,
    document_version: LEGAL_DOCUMENT_VERSION,
  };
}
