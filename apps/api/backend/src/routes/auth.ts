import bcrypt from "bcryptjs"

import { Router } from "express"

import { z } from "zod"

import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_RESPONSIBLE_USE_VERSION,
  CURRENT_TERMS_VERSION
} from "../config/legal-agreements.js"

import { env } from "../config/env.js"

import type { SessionClient, UserRole } from "../generated/prisma/enums.js"

import { HttpError } from "../lib/http-error.js"

import { authenticate, authorize } from "../middlewares/auth.js"

import {
  accountActionLimiter,
  credentialAttemptLimiter
} from "../middlewares/rate-limit.js"

import {
  acceptCurrentCitizenAgreement,
  getCurrentCitizenAgreementStatus
} from "../modules/user-agreements/user-agreement.service.js"

import { validateBody } from "../middlewares/validate.js"

import {
  createAuthSession,
  getRequestSessionClient,
  getSessionCookieName,
  revokeSessionFromRequest,
  roleCanUseClient
} from "../modules/auth-sessions/auth-session.service.js"

import { acceptManagerInviteSchema } from "../modules/manager-invites/manager-invite.schema.js"

import { acceptManagerInvite } from "../modules/manager-invites/manager-invite.service.js"

import {
  requestPasswordReset,
  resetPassword
} from "../modules/password-reset/password-reset.service.js"

import { prisma } from "../prisma/client.js"

import { newPasswordSchema } from "../security/password-policy.js"

const router = Router()

const exposeResetTokenInResponse =
  env.NODE_ENV === "test" ||
  (env.NODE_ENV === "development" && env.EXPOSE_DEV_RESET_TOKEN)

const cookieBaseOptions = {
  httpOnly: true,

  sameSite: "lax" as const,

  secure: env.NODE_ENV === "production",

  path: "/"
}

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase())

const loginPasswordSchema = z.string().min(1).max(128)

const registrationAgreementSchema = z
  .object({
    termsAccepted: z.literal(true),

    privacyAccepted: z.literal(true),

    responsibleUseAccepted: z.literal(true),

    termsVersion: z.literal(CURRENT_TERMS_VERSION),

    privacyVersion: z.literal(CURRENT_PRIVACY_VERSION),

    responsibleUseVersion: z.literal(CURRENT_RESPONSIBLE_USE_VERSION)
  })
  .strict()

const credentialsSchema = z
  .object({
    email: emailSchema,

    password: loginPasswordSchema
  })
  .strict()

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),

    email: emailSchema,

    password: newPasswordSchema,

    agreement: registrationAgreementSchema
  })
  .strict()

const forgotPasswordSchema = z
  .object({
    email: emailSchema
  })
  .strict()

const resetPasswordSchema = z
  .object({
    token: z.string().min(10),

    password: newPasswordSchema
  })
  .strict()

const changePasswordSchema = z
  .object({
    currentPassword: loginPasswordSchema,

    newPassword: newPasswordSchema
  })
  .strict()

function defaultClientForRole(role: UserRole): SessionClient | null {
  if (role === "CITIZEN") {
    return "CITIZEN_PWA"
  }

  if (role === "MANAGER" || role === "ADMIN") {
    return "DASHBOARD"
  }

  return null
}

router.post(
  "/register",

  accountActionLimiter,

  validateBody(registerSchema),

  async (req, res, next) => {
    try {
      const existingUser = await prisma.user.findUnique({
        where: {
          email: req.body.email
        },

        select: {
          id: true
        }
      })

      if (existingUser) {
        throw new HttpError(409, "E-mail já cadastrado.", "EMAIL_EXISTS")
      }

      const passwordHash = await bcrypt.hash(req.body.password, 12)

      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: req.body.name ?? null,

            email: req.body.email,

            passwordHash
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

        const agreement = await tx.userAgreement.create({
          data: {
            userId: createdUser.id,

            termsVersion: req.body.agreement.termsVersion,

            privacyVersion: req.body.agreement.privacyVersion,

            responsibleUseVersion: req.body.agreement.responsibleUseVersion
          }
        })

        await tx.auditLog.create({
          data: {
            actorUserId: createdUser.id,

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

        return createdUser
      })

      return res.status(201).json({
        data: user
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/login",

  credentialAttemptLimiter,

  validateBody(credentialsSchema),

  async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: req.body.email
        }
      })

      if (
        !user ||
        user.status !== "ACTIVE" ||
        !(await bcrypt.compare(req.body.password, user.passwordHash))
      ) {
        throw new HttpError(
          401,
          "Credenciais inválidas.",
          "INVALID_CREDENTIALS"
        )
      }

      const requestedClient = getRequestSessionClient(req)

      const client = requestedClient ?? defaultClientForRole(user.role)

      if (!client) {
        throw new HttpError(
          403,
          "Este perfil não possui uma aplicação de acesso configurada.",
          "UNSUPPORTED_LOGIN_CLIENT"
        )
      }

      if (!roleCanUseClient(user.role, client)) {
        throw new HttpError(
          403,
          client === "CITIZEN_PWA"
            ? "Esta área aceita somente conta de cidadão."
            : "Esta área exige perfil de gestor ou administrador.",
          "ROLE_NOT_ALLOWED_FOR_CLIENT"
        )
      }

      const agreement =
        user.role === "CITIZEN"
          ? await getCurrentCitizenAgreementStatus(user.id)
          : null

      const { token, session, policy } = await createAuthSession(
        user.id,
        client
      )

      res.cookie(getSessionCookieName(client), token, {
        ...cookieBaseOptions,

        maxAge: policy.absoluteTtlMs
      })

      return res.json({
        data: {
          id: user.id,

          name: user.name,

          email: user.email,

          role: user.role,

          status: user.status,

          createdAt: user.createdAt,

          updatedAt: user.updatedAt
        },

        session: {
          id: session.id,

          client: session.client,

          idleExpiresAt: session.idleExpiresAt,

          absoluteExpiresAt: session.absoluteExpiresAt
        },

        agreement
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/manager-invites/accept",

  credentialAttemptLimiter,

  validateBody(acceptManagerInviteSchema),

  async (req, res, next) => {
    try {
      const manager = await acceptManagerInvite(req.body)

      return res.status(201).json({
        data: manager
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/logout",

  async (req, res, next) => {
    try {
      const requestedClient = getRequestSessionClient(req)

      const revokedClient = await revokeSessionFromRequest(req)

      const client = revokedClient ?? requestedClient

      if (client) {
        res.clearCookie(getSessionCookieName(client), cookieBaseOptions)
      }

      return res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/me",

  authenticate,

  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Autenticação obrigatória.", "AUTH_REQUIRED")
      }

      const agreement =
        req.user.role === "CITIZEN"
          ? await getCurrentCitizenAgreementStatus(req.user.id)
          : null

      return res.json({
        data: req.user,

        session: req.authSession,

        agreement
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/agreements/current",

  authenticate,

  authorize("CITIZEN"),

  validateBody(registrationAgreementSchema),

  async (req, res, next) => {
    try {
      const result = await acceptCurrentCitizenAgreement(req.user!.id)

      return res.json({
        data: {
          id: result.agreement.id,

          termsVersion: result.agreement.termsVersion,

          privacyVersion: result.agreement.privacyVersion,

          responsibleUseVersion: result.agreement.responsibleUseVersion,

          acceptedAt: result.agreement.acceptedAt
        },

        meta: {
          created: result.created
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/password/change",

  authenticate,

  validateBody(changePasswordSchema),

  async (req, res, next) => {
    try {
      if (!req.user || !req.authSession) {
        throw new HttpError(401, "Autenticação obrigatória.", "AUTH_REQUIRED")
      }

      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id
        },

        select: {
          id: true,

          passwordHash: true,

          status: true
        }
      })

      if (!user || user.status !== "ACTIVE") {
        throw new HttpError(401, "Sessão inválida.", "INVALID_SESSION")
      }

      const currentPasswordValid = await bcrypt.compare(
        req.body.currentPassword,
        user.passwordHash
      )

      if (!currentPasswordValid) {
        throw new HttpError(
          401,
          "A senha atual está incorreta.",
          "INVALID_CURRENT_PASSWORD"
        )
      }

      const samePassword = await bcrypt.compare(
        req.body.newPassword,
        user.passwordHash
      )

      if (samePassword) {
        throw new HttpError(
          422,
          "A nova senha deve ser diferente da senha atual.",
          "PASSWORD_UNCHANGED"
        )
      }

      const nextPasswordHash = await bcrypt.hash(req.body.newPassword, 12)

      const now = new Date()

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: {
            id: user.id
          },

          data: {
            passwordHash: nextPasswordHash
          }
        })

        await tx.userSession.updateMany({
          where: {
            userId: user.id,

            id: {
              not: req.authSession!.id
            },

            revokedAt: null
          },

          data: {
            revokedAt: now,

            revokedReason: "PASSWORD_CHANGED"
          }
        })

        await tx.passwordResetToken.updateMany({
          where: {
            userId: user.id,

            usedAt: null
          },

          data: {
            usedAt: now
          }
        })

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,

            action: "USER_PASSWORD_CHANGED",

            entityType: "USER",

            entityId: user.id,

            metadata: {
              retainedSessionId: req.authSession!.id
            }
          }
        })
      })

      return res.json({
        data: {
          message: "Senha alterada com sucesso."
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/password/forgot",

  accountActionLimiter,

  validateBody(forgotPasswordSchema),

  async (req, res, next) => {
    try {
      const result = await requestPasswordReset(req.body.email)

      return res.status(202).json({
        data: {
          message:
            "Se existir uma conta ativa para este e-mail, uma solicitação de redefinição foi criada.",

          ...(exposeResetTokenInResponse && result.resetToken
            ? {
                developmentResetToken: result.resetToken
              }
            : {})
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/password/reset",

  accountActionLimiter,

  validateBody(resetPasswordSchema),

  async (req, res, next) => {
    try {
      await resetPassword(req.body.token, req.body.password)

      res.clearCookie(getSessionCookieName("CITIZEN_PWA"), cookieBaseOptions)

      res.clearCookie(getSessionCookieName("DASHBOARD"), cookieBaseOptions)

      return res.json({
        data: {
          message:
            "Senha redefinida com sucesso. Entre novamente com a nova senha."
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

export const authRouter = router
