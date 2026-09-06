import { createHash, randomBytes } from "node:crypto"

import bcrypt from "bcryptjs"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: {
      email
    },

    select: {
      id: true,

      status: true
    }
  })

  if (!user || user.status !== "ACTIVE") {
    return {
      resetToken: null
    }
  }

  const rawToken = randomBytes(32).toString("hex")

  const tokenHash = hashResetToken(rawToken)

  const now = new Date()

  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS)

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,

        usedAt: null
      },

      data: {
        usedAt: now
      }
    })

    const token = await tx.passwordResetToken.create({
      data: {
        userId: user.id,

        tokenHash,

        expiresAt
      }
    })

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,

        action: "PASSWORD_RESET_REQUESTED",

        entityType: "PASSWORD_RESET_TOKEN",

        entityId: token.id,

        metadata: {
          expiresAt: expiresAt.toISOString()
        }
      }
    })
  })

  return {
    resetToken: rawToken
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashResetToken(token)

  const now = new Date()

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash
    },

    include: {
      user: {
        select: {
          id: true,

          status: true
        }
      }
    }
  })

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt <= now ||
    resetToken.user.status !== "ACTIVE"
  ) {
    throw new HttpError(
      400,
      "Token de redefinição inválido ou expirado.",
      "INVALID_PASSWORD_RESET_TOKEN"
    )
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,

        usedAt: null,

        expiresAt: {
          gt: now
        }
      },

      data: {
        usedAt: now
      }
    })

    if (consumed.count !== 1) {
      throw new HttpError(
        400,
        "Token de redefinição inválido ou expirado.",
        "INVALID_PASSWORD_RESET_TOKEN"
      )
    }

    await tx.user.update({
      where: {
        id: resetToken.user.id
      },

      data: {
        passwordHash
      }
    })

    await tx.userSession.updateMany({
      where: {
        userId: resetToken.user.id,

        revokedAt: null
      },

      data: {
        revokedAt: now,

        revokedReason: "PASSWORD_RESET"
      }
    })

    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.user.id,

        usedAt: null
      },

      data: {
        usedAt: now
      }
    })

    await tx.auditLog.create({
      data: {
        actorUserId: resetToken.user.id,

        action: "PASSWORD_RESET_COMPLETED",

        entityType: "USER",

        entityId: resetToken.user.id,

        metadata: {
          resetTokenId: resetToken.id,

          sessionsRevoked: true
        }
      }
    })
  })

  return {
    userId: resetToken.user.id
  }
}
