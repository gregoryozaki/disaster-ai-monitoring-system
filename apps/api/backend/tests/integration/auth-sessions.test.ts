import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"

import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import { prisma } from "../../src/prisma/client.js"

const CLIENT_HEADER = "x-kamara-client"

const CITIZEN_CLIENT = "CITIZEN_PWA"

const DASHBOARD_CLIENT = "DASHBOARD"

const CITIZEN_COOKIE = "kamara_citizen_session"

const DASHBOARD_COOKIE = "kamara_dashboard_session"

const STRONG_PASSWORD = "KamaraSeguro2026!"

function serializedCookies(response: request.Response) {
  const cookies = response.headers["set-cookie"]

  return Array.isArray(cookies)
    ? cookies.join(";")
    : String(cookies ?? "")
}

async function createCitizen(
  password = STRONG_PASSWORD
) {
  const email = `citizen-${randomUUID()}@test.local`

  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Cidadão Sessão",
      email,
      password
    })

  expect(response.status).toBe(201)

  return {
    user: response.body.data,
    email,
    password
  }
}

async function createManager(
  password = STRONG_PASSWORD
) {
  const email = `manager-${randomUUID()}@test.local`

  const passwordHash = await bcrypt.hash(
    password,
    12
  )

  const user = await prisma.user.create({
    data: {
      name: "Gestor Sessão",

      email,

      passwordHash,

      role: "MANAGER",

      status: "ACTIVE"
    }
  })

  return {
    user,
    email,
    password
  }
}

describe("Sessões persistentes", () => {
  it("deve criar sessão persistente de cidadão com cookie exclusivo da PWA", async () => {
    const citizen = await createCitizen()

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    expect(response.status).toBe(200)

    expect(response.body.session.client).toBe(
      CITIZEN_CLIENT
    )

    const cookies = serializedCookies(response)

    expect(cookies).toContain(
      `${CITIZEN_COOKIE}=`
    )

    expect(cookies).not.toContain(
      `${DASHBOARD_COOKIE}=`
    )

    expect(cookies).toContain("HttpOnly")

    const session =
      await prisma.userSession.findUnique({
        where: {
          id: response.body.session.id
        }
      })

    expect(session).not.toBeNull()

    expect(session).toMatchObject({
      userId: citizen.user.id,
      client: CITIZEN_CLIENT,
      revokedAt: null
    })

    expect(
      session!.idleExpiresAt.getTime()
    ).toBeGreaterThan(Date.now())

    expect(
      session!.absoluteExpiresAt.getTime()
    ).toBeGreaterThan(
      session!.idleExpiresAt.getTime()
    )
  })

  it("deve criar sessão persistente de gestor com cookie exclusivo do dashboard", async () => {
    const manager = await createManager()

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(response.status).toBe(200)

    expect(response.body.session.client).toBe(
      DASHBOARD_CLIENT
    )

    const cookies = serializedCookies(response)

    expect(cookies).toContain(
      `${DASHBOARD_COOKIE}=`
    )

    expect(cookies).not.toContain(
      `${CITIZEN_COOKIE}=`
    )

    const session =
      await prisma.userSession.findUnique({
        where: {
          id: response.body.session.id
        }
      })

    expect(session).not.toBeNull()

    expect(session).toMatchObject({
      userId: manager.user.id,
      client: DASHBOARD_CLIENT,
      revokedAt: null
    })

    expect(
      session!.idleExpiresAt.getTime()
    ).toBeGreaterThan(Date.now())

    expect(
      session!.absoluteExpiresAt.getTime()
    ).toBeGreaterThan(
      session!.idleExpiresAt.getTime()
    )
  })

  it("não deve permitir cidadão no dashboard", async () => {
    const citizen = await createCitizen()

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    expect(response.status).toBe(403)

    expect(response.body.error.code).toBe(
      "ROLE_NOT_ALLOWED_FOR_CLIENT"
    )

    const sessions =
      await prisma.userSession.count({
        where: {
          userId: citizen.user.id
        }
      })

    expect(sessions).toBe(0)
  })

  it("não deve permitir gestor na PWA do cidadão", async () => {
    const manager = await createManager()

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(response.status).toBe(403)

    expect(response.body.error.code).toBe(
      "ROLE_NOT_ALLOWED_FOR_CLIENT"
    )

    const sessions =
      await prisma.userSession.count({
        where: {
          userId: manager.user.id
        }
      })

    expect(sessions).toBe(0)
  })

  it("deve manter cidadão e gestor autenticados simultaneamente no mesmo navegador", async () => {
    const citizen = await createCitizen()

    const manager = await createManager()

    const agent = request.agent(app)

    const citizenLogin = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    expect(citizenLogin.status).toBe(200)

    const managerLogin = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(managerLogin.status).toBe(200)

    const citizenMe = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(citizenMe.status).toBe(200)

    expect(citizenMe.body.data).toMatchObject({
      id: citizen.user.id,
      role: "CITIZEN"
    })

    expect(citizenMe.body.session.client).toBe(
      CITIZEN_CLIENT
    )

    const managerMe = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)

    expect(managerMe.status).toBe(200)

    expect(managerMe.body.data).toMatchObject({
      id: manager.user.id,
      role: "MANAGER"
    })

    expect(managerMe.body.session.client).toBe(
      DASHBOARD_CLIENT
    )

    const activeSessions =
      await prisma.userSession.count({
        where: {
          id: {
            in: [
              citizenLogin.body.session.id,
              managerLogin.body.session.id
            ]
          },

          revokedAt: null
        }
      })

    expect(activeSessions).toBe(2)
  })

  it("deve encerrar somente a sessão do cidadão ao sair da PWA", async () => {
    const citizen = await createCitizen()

    const manager = await createManager()

    const agent = request.agent(app)

    const citizenLogin = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    const managerLogin = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(citizenLogin.status).toBe(200)

    expect(managerLogin.status).toBe(200)

    const logoutResponse = await agent
      .post("/api/v1/auth/logout")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(logoutResponse.status).toBe(204)

    const citizenMe = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(citizenMe.status).toBe(401)

    const managerMe = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)

    expect(managerMe.status).toBe(200)

    const citizenSession =
      await prisma.userSession.findUniqueOrThrow({
        where: {
          id: citizenLogin.body.session.id
        }
      })

    const managerSession =
      await prisma.userSession.findUniqueOrThrow({
        where: {
          id: managerLogin.body.session.id
        }
      })

    expect(citizenSession.revokedAt).not.toBeNull()

    expect(citizenSession.revokedReason).toBe(
      "LOGOUT"
    )

    expect(managerSession.revokedAt).toBeNull()
  })

  it("deve encerrar somente a sessão do dashboard ao sair do dashboard", async () => {
    const citizen = await createCitizen()

    const manager = await createManager()

    const agent = request.agent(app)

    const citizenLogin = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    const managerLogin = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(citizenLogin.status).toBe(200)

    expect(managerLogin.status).toBe(200)

    const logoutResponse = await agent
      .post("/api/v1/auth/logout")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)

    expect(logoutResponse.status).toBe(204)

    const dashboardMe = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)

    expect(dashboardMe.status).toBe(401)

    const citizenMe = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(citizenMe.status).toBe(200)

    const managerSession =
      await prisma.userSession.findUniqueOrThrow({
        where: {
          id: managerLogin.body.session.id
        }
      })

    const citizenSession =
      await prisma.userSession.findUniqueOrThrow({
        where: {
          id: citizenLogin.body.session.id
        }
      })

    expect(managerSession.revokedAt).not.toBeNull()

    expect(managerSession.revokedReason).toBe(
      "LOGOUT"
    )

    expect(citizenSession.revokedAt).toBeNull()
  })

  it("deve rejeitar uma sessão revogada no PostgreSQL", async () => {
    const citizen = await createCitizen()

    const agent = request.agent(app)

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    expect(loginResponse.status).toBe(200)

    await prisma.userSession.update({
      where: {
        id: loginResponse.body.session.id
      },

      data: {
        revokedAt: new Date(),

        revokedReason: "TEST_REVOCATION"
      }
    })

    const meResponse = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(meResponse.status).toBe(401)

    expect(meResponse.body.error.code).toBe(
      "INVALID_SESSION"
    )
  })

  it("deve expirar sessão por inatividade", async () => {
    const manager = await createManager()

    const agent = request.agent(app)

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(loginResponse.status).toBe(200)

    await prisma.userSession.update({
      where: {
        id: loginResponse.body.session.id
      },

      data: {
        idleExpiresAt: new Date(
          Date.now() - 60_000
        )
      }
    })

    const meResponse = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)

    expect(meResponse.status).toBe(401)

    expect(meResponse.body.error.code).toBe(
      "INVALID_SESSION"
    )

    const session =
      await prisma.userSession.findUniqueOrThrow({
        where: {
          id: loginResponse.body.session.id
        }
      })

    expect(session.revokedAt).not.toBeNull()

    expect(session.revokedReason).toBe(
      "IDLE_TIMEOUT"
    )
  })

  it("deve expirar sessão ao atingir o limite absoluto", async () => {
    const manager = await createManager()

    const agent = request.agent(app)

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)
      .send({
        email: manager.email,
        password: manager.password
      })

    expect(loginResponse.status).toBe(200)

    await prisma.userSession.update({
      where: {
        id: loginResponse.body.session.id
      },

      data: {
        absoluteExpiresAt: new Date(
          Date.now() - 60_000
        ),

        idleExpiresAt: new Date(
          Date.now() + 60 * 60 * 1000
        )
      }
    })

    const meResponse = await agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, DASHBOARD_CLIENT)

    expect(meResponse.status).toBe(401)

    expect(meResponse.body.error.code).toBe(
      "INVALID_SESSION"
    )

    const session =
      await prisma.userSession.findUniqueOrThrow({
        where: {
          id: loginResponse.body.session.id
        }
      })

    expect(session.revokedAt).not.toBeNull()

    expect(session.revokedReason).toBe(
      "ABSOLUTE_TIMEOUT"
    )
  })

  it("deve revogar todas as sessões da conta após redefinição de senha", async () => {
    const citizen = await createCitizen()

    const firstAgent = request.agent(app)

    const secondAgent = request.agent(app)

    const firstLogin = await firstAgent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    const secondLogin = await secondAgent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    expect(firstLogin.status).toBe(200)

    expect(secondLogin.status).toBe(200)

    const activeBefore =
      await prisma.userSession.count({
        where: {
          userId: citizen.user.id,

          revokedAt: null
        }
      })

    expect(activeBefore).toBe(2)

    const forgotResponse = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: citizen.email
      })

    expect(forgotResponse.status).toBe(202)

    const resetToken =
      forgotResponse.body.data
        .developmentResetToken

    expect(typeof resetToken).toBe("string")

    const newPassword =
      "NovaSenhaKamara2026!"

    const resetResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token: resetToken,
        password: newPassword
      })

    expect(resetResponse.status).toBe(200)

    const sessions =
      await prisma.userSession.findMany({
        where: {
          userId: citizen.user.id
        }
      })

    expect(sessions).toHaveLength(2)

    expect(
      sessions.every(
        (session) =>
          session.revokedAt !== null &&
          session.revokedReason ===
            "PASSWORD_RESET"
      )
    ).toBe(true)

    const firstMe = await firstAgent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    const secondMe = await secondAgent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(firstMe.status).toBe(401)

    expect(secondMe.status).toBe(401)

    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: citizen.password
      })

    expect(oldPasswordLogin.status).toBe(401)

    const newPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email: citizen.email,
        password: newPassword
      })

    expect(newPasswordLogin.status).toBe(200)
  })
})

describe("Política de senha", () => {
  it.each([
    [
      "menos de 12 caracteres",
      "Aa1!curta"
    ],

    [
      "sem letra maiúscula",
      "kamaraseguro2026!"
    ],

    [
      "sem letra minúscula",
      "KAMARASEGURO2026!"
    ],

    [
      "sem número",
      "KamaraSeguroSemNumero!"
    ],

    [
      "sem caractere especial",
      "KamaraSeguro2026"
    ]
  ])(
    "deve rejeitar nova senha %s",
    async (_description, password) => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Senha Fraca",

          email: `weak-${randomUUID()}@test.local`,

          password
        })

      expect(response.status).toBe(422)

      expect(response.body.error.code).toBe(
        "VALIDATION_ERROR"
      )
    }
  )

  it("deve aceitar senha que cumpra todos os requisitos", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Senha Forte",

        email: `strong-${randomUUID()}@test.local`,

        password: STRONG_PASSWORD
      })

    expect(response.status).toBe(201)
  })

  it("deve aplicar política forte também na redefinição de senha", async () => {
    const citizen = await createCitizen()

    const forgotResponse = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: citizen.email
      })

    expect(forgotResponse.status).toBe(202)

    const token =
      forgotResponse.body.data
        .developmentResetToken

    const resetResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token,

        password: "senha-fraca"
      })

    expect(resetResponse.status).toBe(422)

    expect(resetResponse.body.error.code).toBe(
      "VALIDATION_ERROR"
    )
  })

  it("deve permitir cadastro de cidadão sem nome", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: `anonymous-${randomUUID()}@test.local`,

        password: STRONG_PASSWORD
      })

    expect(response.status).toBe(201)

    expect(response.body.data.name).toBeNull()

    expect(response.body.data.role).toBe(
      "CITIZEN"
    )
  })
})
