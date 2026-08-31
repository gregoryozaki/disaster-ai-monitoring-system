import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

import { env } from "../config/env.js"
import type { UserRole, UserStatus } from "../generated/prisma/enums.js"
import { HttpError } from "../lib/http-error.js"
import { prisma } from "../prisma/client.js"

export interface AuthenticatedUser {
  id: string
  name: string | null
  email: string
  role: UserRole
  status: UserStatus
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser
  }
}

export function signSession(userId: string): string {
  return jwt.sign(
    {
      sub: userId
    },
    env.JWT_SECRET,
    {
      expiresIn: "2h"
    }
  )
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token =
    req.cookies?.kamara_session ?? readBearerToken(req.headers.authorization)

  if (!token) {
    return next(
      new HttpError(401, "Autenticação obrigatória.", "AUTH_REQUIRED")
    )
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload

    if (typeof payload.sub !== "string" || !payload.sub) {
      return next(new HttpError(401, "Sessão inválida.", "INVALID_SESSION"))
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true
      }
    })

    if (!user || user.status !== "ACTIVE") {
      return next(new HttpError(401, "Sessão inválida.", "INVALID_SESSION"))
    }

    req.user = user

    return next()
  } catch {
    return next(
      new HttpError(401, "Sessão inválida ou expirada.", "INVALID_SESSION")
    )
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

function readBearerToken(header?: string) {
  if (!header?.startsWith("Bearer ")) {
    return undefined
  }

  return header.slice("Bearer ".length)
}
