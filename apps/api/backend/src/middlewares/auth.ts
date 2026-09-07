import type { NextFunction, Request, Response } from "express"

import type {
  SessionClient,
  UserRole,
  UserStatus
} from "../generated/prisma/enums.js"

import { HttpError } from "../lib/http-error.js"

import { loadActiveSession } from "../modules/auth-sessions/auth-session.service.js"

import { getCurrentCitizenAgreementStatus } from "../modules/user-agreements/user-agreement.service.js"

export interface AuthenticatedUser {
  id: string
  name: string | null
  email: string
  role: UserRole
  status: UserStatus
}

export interface AuthenticatedSession {
  id: string
  client: SessionClient
  createdAt: Date
  lastSeenAt: Date
  idleExpiresAt: Date
  absoluteExpiresAt: Date
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser
    authSession?: AuthenticatedSession
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authenticated = await loadActiveSession(req)

    req.user = authenticated.user

    req.authSession = authenticated.session

    return next()
  } catch (error) {
    return next(error)
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new HttpError(401, "Autenticação obrigatória.", "AUTH_REQUIRED")
      )
    }

    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "Permissão insuficiente.", "FORBIDDEN"))
    }

    return next()
  }
}

export async function requireCurrentCitizenAgreement(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new HttpError(401, "Autenticação obrigatória.", "AUTH_REQUIRED")
    }

    if (req.user.role !== "CITIZEN") {
      return next()
    }

    const agreement = await getCurrentCitizenAgreementStatus(req.user.id)

    if (agreement.required) {
      throw new HttpError(
        428,
        "É necessário aceitar os documentos vigentes para continuar.",
        "CURRENT_AGREEMENT_REQUIRED"
      )
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
