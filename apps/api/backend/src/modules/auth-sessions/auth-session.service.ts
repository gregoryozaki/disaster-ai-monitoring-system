import type { Request } from "express"
import jwt from "jsonwebtoken"

import { env } from "../../config/env.js"

import type { SessionClient, UserRole } from "../../generated/prisma/enums.js"

import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

export const SESSION_CLIENT_HEADER = "x-kamara-client"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

const SESSION_TOUCH_INTERVAL_MS = 5 * MINUTE_MS

interface SessionPolicy {
  cookieName: string
  idleTtlMs: number
  absoluteTtlMs: number
}

const SESSION_POLICIES: Record<SessionClient, SessionPolicy> = {
  CITIZEN_PWA: {
    cookieName: "kamara_citizen_session",
    idleTtlMs: 2 * HOUR_MS,
    absoluteTtlMs: 24 * HOUR_MS
  },

  DASHBOARD: {
    cookieName: "kamara_dashboard_session",
    idleTtlMs: 30 * MINUTE_MS,
    absoluteTtlMs: 8 * HOUR_MS
  }
}

interface SessionJwtPayload extends jwt.JwtPayload {
  sub: string
  sid: string
  client: SessionClient
}

function isSessionClient(value: unknown): value is SessionClient {
  return value === "CITIZEN_PWA" || value === "DASHBOARD"
}

function minDate(first: Date, second: Date) {
  return first.getTime() <= second.getTime() ? first : second
}

function inferClientFromUrl(value?: string): SessionClient | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)

    if (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "3001"
    ) {
      return "CITIZEN_PWA"
    }

    if (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "3002"
    ) {
      return "DASHBOARD"
    }
  } catch {
    return null
  }

  return null
}

function inferClientFromPath(req: Request): SessionClient | null {
  const path = req.originalUrl

  if (
    path.startsWith("/api/v1/manager") ||
    path.startsWith("/api/v1/admin") ||
    path.startsWith("/api/v1/analytics") ||
    path.startsWith("/api/v1/predictions") ||
    path.startsWith("/api/v1/exports")
  ) {
    return "DASHBOARD"
  }

  if (path.startsWith("/api/v1/occurrences")) {
    return "CITIZEN_PWA"
  }

  return null
}

export function getSessionPolicy(client: SessionClient) {
  return SESSION_POLICIES[client]
}

export function getSessionCookieName(client: SessionClient) {
  return getSessionPolicy(client).cookieName
}

export function getRequestSessionClient(req: Request): SessionClient | null {
  const header = req.get(SESSION_CLIENT_HEADER)

  if (isSessionClient(header)) {
    return header
  }

  const originClient = inferClientFromUrl(req.get("origin"))

  if (originClient) {
    return originClient
  }

  const refererClient = inferClientFromUrl(req.get("referer"))

  if (refererClient) {
    return refererClient
  }

  return inferClientFromPath(req)
}

export function requireRequestSessionClient(req: Request): SessionClient {
  const client = getRequestSessionClient(req)

  if (!client) {
    throw new HttpError(
      422,
      "Cliente de autenticação não informado.",
      "SESSION_CLIENT_REQUIRED"
    )
  }

  return client
}

export function roleCanUseClient(role: UserRole, client: SessionClient) {
  if (client === "CITIZEN_PWA") {
    return role === "CITIZEN"
  }

  return role === "MANAGER" || role === "ADMIN"
}

export async function createAuthSession(userId: string, client: SessionClient) {
  const policy = getSessionPolicy(client)

  const now = new Date()

  const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteTtlMs)

  const idleExpiresAt = minDate(
    new Date(now.getTime() + policy.idleTtlMs),
    absoluteExpiresAt
  )

  const session = await prisma.userSession.create({
    data: {
      userId,
      client,
      lastSeenAt: now,
      idleExpiresAt,
      absoluteExpiresAt
    }
  })

  const token = jwt.sign(
    {
      sub: userId,
      sid: session.id,
      client
    },
    env.JWT_SECRET,
    {
      expiresIn: Math.floor(policy.absoluteTtlMs / 1000)
    }
  )

  return {
    token,
    session,
    policy
  }
}

function readBearerToken(header?: string) {
  if (!header?.startsWith("Bearer ")) {
    return null
  }

  return header.slice("Bearer ".length)
}

export function readSessionToken(req: Request): {
  token: string
  requestedClient: SessionClient | null
} | null {
  const bearerToken = readBearerToken(req.headers.authorization)

  if (bearerToken) {
    return {
      token: bearerToken,

      requestedClient: null
    }
  }

  const requestedClient = getRequestSessionClient(req)

  if (requestedClient) {
    const token = req.cookies?.[getSessionCookieName(requestedClient)]

    if (typeof token === "string" && token) {
      return {
        token,

        requestedClient
      }
    }

    return null
  }
  const citizenToken = req.cookies?.[getSessionCookieName("CITIZEN_PWA")]

  const dashboardToken = req.cookies?.[getSessionCookieName("DASHBOARD")]

  const hasCitizenToken =
    typeof citizenToken === "string" && Boolean(citizenToken)

  const hasDashboardToken =
    typeof dashboardToken === "string" && Boolean(dashboardToken)

  if (hasCitizenToken && !hasDashboardToken) {
    return {
      token: citizenToken,

      requestedClient: "CITIZEN_PWA"
    }
  }

  if (hasDashboardToken && !hasCitizenToken) {
    return {
      token: dashboardToken,

      requestedClient: "DASHBOARD"
    }
  }

  return null
}

export function verifySessionToken(token: string): SessionJwtPayload {
  let payload: jwt.JwtPayload

  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload
  } catch {
    throw new HttpError(401, "Sessão inválida ou expirada.", "INVALID_SESSION")
  }

  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.sid !== "string" ||
    !payload.sid ||
    !isSessionClient(payload.client)
  ) {
    throw new HttpError(401, "Sessão inválida.", "INVALID_SESSION")
  }

  return payload as SessionJwtPayload
}

export async function loadActiveSession(req: Request) {
  const tokenContext = readSessionToken(req)

  if (!tokenContext) {
    throw new HttpError(401, "Autenticação obrigatória.", "AUTH_REQUIRED")
  }

  const payload = verifySessionToken(tokenContext.token)

  if (
    tokenContext.requestedClient &&
    tokenContext.requestedClient !== payload.client
  ) {
    throw new HttpError(401, "Sessão inválida.", "INVALID_SESSION")
  }

  const session = await prisma.userSession.findUnique({
    where: {
      id: payload.sid
    },

    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true
        }
      }
    }
  })

  const now = new Date()

  if (
    !session ||
    session.userId !== payload.sub ||
    session.client !== payload.client ||
    session.revokedAt !== null ||
    session.user.status !== "ACTIVE"
  ) {
    throw new HttpError(401, "Sessão inválida.", "INVALID_SESSION")
  }

  if (session.absoluteExpiresAt <= now || session.idleExpiresAt <= now) {
    await prisma.userSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null
      },

      data: {
        revokedAt: now,

        revokedReason:
          session.absoluteExpiresAt <= now ? "ABSOLUTE_TIMEOUT" : "IDLE_TIMEOUT"
      }
    })

    throw new HttpError(401, "Sessão expirada.", "INVALID_SESSION")
  }

  if (
    now.getTime() - session.lastSeenAt.getTime() >=
    SESSION_TOUCH_INTERVAL_MS
  ) {
    const policy = getSessionPolicy(session.client)

    const nextIdleExpiresAt = minDate(
      new Date(now.getTime() + policy.idleTtlMs),
      session.absoluteExpiresAt
    )

    await prisma.userSession.updateMany({
      where: {
        id: session.id,

        revokedAt: null,

        absoluteExpiresAt: {
          gt: now
        }
      },

      data: {
        lastSeenAt: now,

        idleExpiresAt: nextIdleExpiresAt
      }
    })
  }

  return {
    user: session.user,

    session: {
      id: session.id,
      client: session.client,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt
    }
  }
}

export async function revokeSessionFromRequest(
  req: Request,
  reason = "LOGOUT"
) {
  const tokenContext = readSessionToken(req)

  if (!tokenContext) {
    return
  }

  let payload: SessionJwtPayload

  try {
    payload = verifySessionToken(tokenContext.token)
  } catch {
    return
  }

  await prisma.userSession.updateMany({
    where: {
      id: payload.sid,
      userId: payload.sub,
      revokedAt: null
    },

    data: {
      revokedAt: new Date(),
      revokedReason: reason
    }
  })
}

export async function revokeAllUserSessions(userId: string, reason: string) {
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null
    },

    data: {
      revokedAt: new Date(),
      revokedReason: reason
    }
  })
}
