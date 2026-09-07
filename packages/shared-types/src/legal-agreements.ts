export const CURRENT_TERMS_VERSION = "2026-09-07.1"

export const CURRENT_PRIVACY_VERSION = "2026-09-07.1"

export const CURRENT_RESPONSIBLE_USE_VERSION = "2026-09-07.1"

export interface CitizenRegistrationAgreement {
  termsAccepted: true

  privacyAccepted: true

  responsibleUseAccepted: true

  termsVersion: string

  privacyVersion: string

  responsibleUseVersion: string
}

export const CURRENT_CITIZEN_REGISTRATION_AGREEMENT = {
  termsAccepted: true,

  privacyAccepted: true,

  responsibleUseAccepted: true,

  termsVersion: CURRENT_TERMS_VERSION,

  privacyVersion: CURRENT_PRIVACY_VERSION,

  responsibleUseVersion: CURRENT_RESPONSIBLE_USE_VERSION
} as const satisfies CitizenRegistrationAgreement
