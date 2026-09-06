import { createHash, randomBytes, randomUUID } from "node:crypto"

import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedAdmin,
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

describe("Administração de gestores e convites", () => {
  it("deve criar convite persistente armazenando somente o hash do token", async () => {
    const admin = await createAuthenticatedAdmin()

    const email = `invited-${randomUUID()}@test.local`

    const response = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Convidado",

        email
      })

    expect(response.status).toBe(201)

    expect(response.body.data.manager).toMatchObject({
      name: "Gestor Convidado",

      email,

      role: "MANAGER",

      status: "INVITED"
    })

    expect(typeof response.body.data.inviteToken).toBe("string")

    expect(response.body.data.inviteToken.length).toBeGreaterThanOrEqual(32)

    const inviteToken = response.body.data.inviteToken

    const expectedHash = hashToken(inviteToken)

    const storedInvite = await prisma.managerInvite.findUniqueOrThrow({
      where: {
        tokenHash: expectedHash
      }
    })

    expect(storedInvite.email).toBe(email)

    expect(storedInvite.tokenHash).toBe(expectedHash)

    expect(storedInvite.tokenHash).not.toBe(inviteToken)

    expect(storedInvite.usedAt).toBeNull()

    expect(storedInvite.acceptedByUserId).toBeNull()

    expect(storedInvite.createdByAdminId).toBe(admin.user.id)

    const storedManager = await prisma.user.findUniqueOrThrow({
      where: {
        email
      }
    })

    expect(storedManager.role).toBe("MANAGER")

    expect(storedManager.status).toBe("INVITED")

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "MANAGER_INVITED",

        entityId: storedManager.id
      }
    })

    expect(audit).not.toBeNull()
  })

  it("não deve permitir que cidadão crie convite de gestor", async () => {
    const citizen = await createAuthenticatedCitizen()

    const response = await citizen.agent
      .post("/api/v1/admin/managers/invites")
      .set("x-kamara-client", "CITIZEN_PWA")
      .send({
        name: "Gestor Não Autorizado",

        email: `forbidden-${randomUUID()}@test.local`
      })

    expect(response.status).toBe(403)
  })

  it("não deve criar segundo convite enquanto já existir convite ativo", async () => {
    const admin = await createAuthenticatedAdmin()

    const email = `duplicate-${randomUUID()}@test.local`

    const first = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Duplicado",

        email
      })

    expect(first.status).toBe(201)

    const second = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Duplicado",

        email
      })

    expect(second.status).toBe(409)

    expect(second.body.error.code).toBe("ACTIVE_MANAGER_INVITE_EXISTS")

    const count = await prisma.managerInvite.count({
      where: {
        email
      }
    })

    expect(count).toBe(1)
  })

  it("deve aceitar convite, ativar gestor e permitir login", async () => {
    const admin = await createAuthenticatedAdmin()

    const email = `accepted-${randomUUID()}@test.local`

    const password = "NovoGestor123!"

    const inviteResponse = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Ativado",

        email
      })

    expect(inviteResponse.status).toBe(201)

    const inviteToken = inviteResponse.body.data.inviteToken

    const acceptResponse = await request(app)
      .post("/api/v1/auth/manager-invites/accept")
      .send({
        token: inviteToken,

        password
      })

    expect(acceptResponse.status).toBe(201)

    expect(acceptResponse.body.data).toMatchObject({
      name: "Gestor Ativado",

      email,

      role: "MANAGER",

      status: "ACTIVE"
    })

    const managerId = acceptResponse.body.data.id

    const invite = await prisma.managerInvite.findUniqueOrThrow({
      where: {
        tokenHash: hashToken(inviteToken)
      }
    })

    expect(invite.usedAt).not.toBeNull()

    expect(invite.acceptedByUserId).toBe(managerId)

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email,

      password
    })

    expect(loginResponse.status).toBe(200)

    expect(loginResponse.body.data.role).toBe("MANAGER")

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "MANAGER_INVITE_ACCEPTED",

        entityId: managerId
      }
    })

    expect(audit).not.toBeNull()
  })

  it("não deve permitir reutilizar o mesmo convite", async () => {
    const admin = await createAuthenticatedAdmin()

    const email = `single-use-${randomUUID()}@test.local`

    const inviteResponse = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Uso Único",

        email
      })

    expect(inviteResponse.status).toBe(201)

    const token = inviteResponse.body.data.inviteToken

    const first = await request(app)
      .post("/api/v1/auth/manager-invites/accept")
      .send({
        token,

        password: "PrimeiraSenha123!"
      })

    expect(first.status).toBe(201)

    const second = await request(app)
      .post("/api/v1/auth/manager-invites/accept")
      .send({
        token,

        password: "SegundaSenha123!"
      })

    expect(second.status).toBe(400)

    expect(second.body.error.code).toBe("INVALID_MANAGER_INVITE")

    const managerCount = await prisma.user.count({
      where: {
        email
      }
    })

    expect(managerCount).toBe(1)
  })

  it("não deve aceitar convite expirado", async () => {
    const admin = await createAuthenticatedAdmin()

    const email = `expired-${randomUUID()}@test.local`

    const token = randomBytes(32).toString("base64url")

    await prisma.user.create({
      data: {
        name: "Gestor Expirado",

        email,

        passwordHash: "temporary-unused-hash",

        role: "MANAGER",

        status: "INVITED"
      }
    })

    await prisma.managerInvite.create({
      data: {
        email,

        tokenHash: hashToken(token),

        createdByAdminId: admin.user.id,

        expiresAt: new Date(Date.now() - 60_000)
      }
    })

    const response = await request(app)
      .post("/api/v1/auth/manager-invites/accept")
      .send({
        token,

        password: "SenhaNova123!"
      })

    expect(response.status).toBe(400)

    expect(response.body.error.code).toBe("INVALID_MANAGER_INVITE")

    const manager = await prisma.user.findUniqueOrThrow({
      where: {
        email
      }
    })

    expect(manager.status).toBe("INVITED")
  })

  it("deve listar gestores reais e permitir desativar um gestor ativo", async () => {
    const admin = await createAuthenticatedAdmin()

    const manager = await createAuthenticatedManager()

    const listResponse = await admin.agent.get("/api/v1/admin/managers")

    expect(listResponse.status).toBe(200)

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: manager.user.id,

          role: "MANAGER",

          status: "ACTIVE"
        }),

        expect.objectContaining({
          id: admin.user.id,

          role: "ADMIN"
        })
      ])
    )

    const statusResponse = await admin.agent
      .patch(`/api/v1/admin/managers/${manager.user.id}/status`)
      .send({
        status: "INACTIVE"
      })

    expect(statusResponse.status).toBe(200)

    expect(statusResponse.body.data.status).toBe("INACTIVE")

    expect(statusResponse.body.data.deactivatedAt).not.toBeNull()

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: manager.credentials.email,

      password: manager.credentials.password
    })

    expect(loginResponse.status).toBe(401)

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "MANAGER_STATUS_CHANGED",

        entityId: manager.user.id
      }
    })

    expect(audit).not.toBeNull()
  })
})
