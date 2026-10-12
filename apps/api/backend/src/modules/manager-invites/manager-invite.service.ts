import { createHash, randomBytes } from "node:crypto"

import bcrypt from "bcryptjs"

import { env } from "../../config/env.js"

import { sendMailInBackground } from "../../integrations/mail/smtp-mailer.js"

import {
  buildAppUrl,
  managerInviteEmail
} from "../../integrations/mail/templates.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import type {
  AcceptManagerInviteInput,
  CreateManagerInviteInput
} from "./manager-invite.schema.js"

const MANAGER_INVITE_TTL_HOURS = 24

const MANAGER_INVITE_TTL_MS = MANAGER_INVITE_TTL_HOURS * 60 * 60 * 1000

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

function invalidInviteError() {
  return new HttpError(
    400,
    "Convite inválido, expirado ou já utilizado.",
    "INVALID_MANAGER_INVITE"
  )
}

export async function createManagerInvite(
  adminId: string,
  input: CreateManagerInviteInput
) {
  const now = new Date()

  const expiresAt = new Date(now.getTime() + MANAGER_INVITE_TTL_MS)

  const inviteToken = randomBytes(32).toString("base64url")

  const tokenHash = hashInviteToken(inviteToken)

  const temporaryPassword = randomBytes(48).toString("base64url")

  const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12)

  try {
    const result = await prisma.$transaction(async (tx) => {
      let manager = await tx.user.findUnique({
        where: {
          email: input.email
        }
      })

      if (manager) {
        if (manager.role !== "MANAGER" || manager.status !== "INVITED") {
          throw new HttpError(409, "E-mail já cadastrado.", "EMAIL_EXISTS")
        }

        manager = await tx.user.update({
          where: {
            id: manager.id
          },

          data: {
            name: input.name
          }
        })
      }

      const activeInvite = await tx.managerInvite.findFirst({
        where: {
          email: input.email,

          usedAt: null,

          expiresAt: {
            gt: now
          }
        },

        select: {
          id: true
        }
      })

      if (activeInvite) {
        throw new HttpError(
          409,
          "Já existe um convite ativo para este e-mail.",
          "ACTIVE_MANAGER_INVITE_EXISTS"
        )
      }

      if (!manager) {
        manager = await tx.user.create({
          data: {
            name: input.name,

            email: input.email,

            passwordHash: temporaryPasswordHash,

            role: "MANAGER",

            status: "INVITED"
          }
        })
      }

      const invite = await tx.managerInvite.create({
        data: {
          email: input.email,

          tokenHash,

          createdByAdminId: adminId,

          expiresAt
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,

          action: "MANAGER_INVITED",

          entityType: "USER",

          entityId: manager.id,

          afterData: {
            role: "MANAGER",

            status: "INVITED",

            email: manager.email
          },

          metadata: {
            inviteId: invite.id,

            expiresAt: expiresAt.toISOString()
          }
        }
      })

      return {
        manager,

        invite
      }
    })

    sendMailInBackground(
      managerInviteEmail({
        to: result.invite.email,

        name: result.manager.name ?? input.name,

        acceptUrl: buildAppUrl(env.DASHBOARD_APP_URL, "accept-invite", {
          token: inviteToken
        }),

        expiresInHours: MANAGER_INVITE_TTL_HOURS
      }),

      "convite de gestor"
    )

    return {
      manager: {
        id: result.manager.id,

        name: result.manager.name,

        email: result.manager.email,

        role: result.manager.role,

        status: result.manager.status,

        createdAt: result.manager.createdAt,

        updatedAt: result.manager.updatedAt
      },

      invite: {
        id: result.invite.id,

        email: result.invite.email,

        expiresAt: result.invite.expiresAt,

        createdAt: result.invite.createdAt
      },

      inviteToken
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(
        409,
        "Já existe uma conta ou convite concorrente para este e-mail.",
        "MANAGER_INVITE_CONFLICT"
      )
    }

    throw error
  }
}

export async function acceptManagerInvite(input: AcceptManagerInviteInput) {
  const tokenHash = hashInviteToken(input.token)

  const now = new Date()

  const passwordHash = await bcrypt.hash(input.password, 12)

  return prisma.$transaction(async (tx) => {
    const invite = await tx.managerInvite.findUnique({
      where: {
        tokenHash
      }
    })

    if (!invite || invite.usedAt !== null || invite.expiresAt <= now) {
      throw invalidInviteError()
    }

    const manager = await tx.user.findUnique({
      where: {
        email: invite.email
      }
    })

    if (
      !manager ||
      manager.role !== "MANAGER" ||
      manager.status !== "INVITED"
    ) {
      throw invalidInviteError()
    }

    const managerClaim = await tx.user.updateMany({
      where: {
        id: manager.id,

        role: "MANAGER",

        status: "INVITED"
      },

      data: {
        passwordHash,

        status: "ACTIVE",

        deactivatedAt: null
      }
    })

    if (managerClaim.count !== 1) {
      throw invalidInviteError()
    }

    /*
     * O convite também é consumido
     * condicionalmente.
     */
    const inviteClaim = await tx.managerInvite.updateMany({
      where: {
        id: invite.id,

        usedAt: null,

        expiresAt: {
          gt: now
        }
      },

      data: {
        usedAt: now,

        acceptedByUserId: manager.id
      }
    })

    if (inviteClaim.count !== 1) {
      throw invalidInviteError()
    }

    await tx.auditLog.create({
      data: {
        actorUserId: manager.id,

        action: "MANAGER_INVITE_ACCEPTED",

        entityType: "USER",

        entityId: manager.id,

        beforeData: {
          status: "INVITED"
        },

        afterData: {
          status: "ACTIVE",

          role: "MANAGER"
        },

        metadata: {
          inviteId: invite.id
        }
      }
    })

    return tx.user.findUniqueOrThrow({
      where: {
        id: manager.id
      },

      select: {
        id: true,

        name: true,

        email: true,

        role: true,

        status: true,

        createdAt: true,

        updatedAt: true
      }
    })
  })
}
