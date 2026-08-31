import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"

import { env } from "../config/env.js"
import { HttpError } from "../lib/http-error.js"
import { authenticate, signSession } from "../middlewares/auth.js"
import { validateBody } from "../middlewares/validate.js"
import { prisma } from "../prisma/client.js"

const router = Router()

const cookieBaseOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production"
}

const sessionCookieOptions = {
  ...cookieBaseOptions,
  maxAge: 2 * 60 * 60 * 1000
}

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase())

const passwordSchema = z.string().min(8).max(128)

const credentialsSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema
  })
  .strict()

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),

    email: emailSchema,

    password: passwordSchema
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

    password: passwordSchema
  })
  .strict()

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
          name: req.body.name,
          email: req.body.email,
          passwordHash

          /*
           * role e status não vêm do cliente.
           *
           * CITIZEN e ACTIVE são definidos
           * pelos defaults do schema Prisma.
           */
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

      const token = signSession(user.id)

      res.cookie("kamara_session", token, sessionCookieOptions)

      return res.json({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post("/logout", (_req, res) => {
  res.clearCookie("kamara_session", cookieBaseOptions)

  return res.status(204).send()
})

router.get("/me", authenticate, (req, res) => {
  return res.json({
    data: req.user
  })
})

/*
 * Ainda não implementados de verdade.
 *
 * Mantemos contrato neutro até implementar
 * PasswordResetToken e envio de e-mail.
 */

router.post(
  "/password/forgot",
  validateBody(forgotPasswordSchema),
  (_req, res) => {
    return res.status(202).json({
      data: {
        message: "Se existir uma conta, as instruções serão enviadas."
      }
    })
  }
)

router.post(
  "/password/reset",
  validateBody(resetPasswordSchema),
  (_req, res) => {
    return res.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",

        message: "Redefinição de senha ainda não implementada."
      }
    })
  }
)

export const authRouter = router
