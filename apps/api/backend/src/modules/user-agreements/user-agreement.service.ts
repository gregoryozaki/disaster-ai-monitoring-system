import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_RESPONSIBLE_USE_VERSION,
  CURRENT_TERMS_VERSION
} from "../../config/legal-agreements.js"

import { prisma } from "../../prisma/client.js"

function currentAgreementWhere(userId: string) {
  return {
    userId_termsVersion_privacyVersion_responsibleUseVersion: {
      userId,

      termsVersion: CURRENT_TERMS_VERSION,

      privacyVersion: CURRENT_PRIVACY_VERSION,

      responsibleUseVersion: CURRENT_RESPONSIBLE_USE_VERSION
    }
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

export async function getCurrentCitizenAgreementStatus(userId: string) {
  const agreement = await prisma.userAgreement.findUnique({
    where: currentAgreementWhere(userId),

    select: {
      acceptedAt: true
    }
  })

  return {
    required: agreement === null,

    termsVersion: CURRENT_TERMS_VERSION,

    privacyVersion: CURRENT_PRIVACY_VERSION,

    responsibleUseVersion: CURRENT_RESPONSIBLE_USE_VERSION,

    acceptedAt: agreement?.acceptedAt ?? null
  }
}

export async function acceptCurrentCitizenAgreement(userId: string) {
  const where = currentAgreementWhere(userId)

  const existing = await prisma.userAgreement.findUnique({
    where
  })

  if (existing) {
    return {
      agreement: existing,

      created: false
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const agreement = await tx.userAgreement.create({
        data: {
          userId,

          termsVersion: CURRENT_TERMS_VERSION,

          privacyVersion: CURRENT_PRIVACY_VERSION,

          responsibleUseVersion: CURRENT_RESPONSIBLE_USE_VERSION
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: userId,

          action: "USER_AGREEMENT_ACCEPTED",

          entityType: "USER_AGREEMENT",

          entityId: agreement.id,

          metadata: {
            termsVersion: agreement.termsVersion,

            privacyVersion: agreement.privacyVersion,

            responsibleUseVersion: agreement.responsibleUseVersion
          }
        }
      })

      return {
        agreement,

        created: true
      }
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const agreement = await prisma.userAgreement.findUnique({
      where
    })

    if (!agreement) {
      throw error
    }

    return {
      agreement,

      created: false
    }
  }
}
