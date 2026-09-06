import bcrypt from "bcryptjs"

import { Router } from "express"

import { z } from "zod"

import { env } from "../config/env.js"

import type { SessionClient, UserRole } from "../generated/prisma/enums.js"

import { HttpError } from "../lib/http-error.js"

import { authenticate } from "../middlewares/auth.js"

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

    password: newPasswordSchema
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

      const user = await prisma.user.create({
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
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/manager-invites/accept",

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

  (req, res) => {
    return res.json({
      data: req.user,

      session: req.authSession
    })
  }
)

router.post(
  "/password/forgot",

  validateBody(forgotPasswordSchema),

  async (req, res, next) => {
    try {
      const result = await requestPasswordReset(req.body.email)

      return res.status(202).json({
        data: {
          message:
            "Se existir uma conta ativa para este e-mail, uma solicitação de redefinição foi criada.",

          ...(env.NODE_ENV !== "production" && result.resetToken
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
