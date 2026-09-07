import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"

import request from "supertest"

import { CURRENT_CITIZEN_REGISTRATION_AGREEMENT } from "@kamara/shared-types"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import { prisma } from "../../src/prisma/client.js"

const CLIENT_HEADER = "x-kamara-client"

const CITIZEN_CLIENT = "CITIZEN_PWA"

const PASSWORD = "KamaraAgreement2026!"

async function createLegacyCitizen() {
  const email = `legacy-${randomUUID()}@test.local`

  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const user = await prisma.user.create({
    data: {
      name: "Cidadão Legado",

      email,

      passwordHash,

      role: "CITIZEN",

      status: "ACTIVE"
    }
  })

  return {
    user,

    email,

    password: PASSWORD
  }
}

async function loginLegacyCitizen() {
  const citizen = await createLegacyCitizen()

  const agent = request.agent(app)

  const login = await agent
    .post("/api/v1/auth/login")
    .set(CLIENT_HEADER, CITIZEN_CLIENT)
    .send({
      email: citizen.email,

      password: citizen.password
    })

  expect(login.status).toBe(200)

  return {
    ...citizen,

    agent,

    login
  }
}

describe("Aceite vigente do cidadão", () => {
  it("deve informar que conta legada precisa aceitar os documentos vigentes", async () => {
    const citizen = await loginLegacyCitizen()

    expect(citizen.login.body.agreement).toMatchObject({
      required: true,

      termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

      privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

      responsibleUseVersion:
        CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion,

      acceptedAt: null
    })

    const me = await citizen.agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(me.status).toBe(200)

    expect(me.body.agreement.required).toBe(true)
  })

  it("deve bloquear rota autenticada do cidadão enquanto o aceite vigente estiver pendente", async () => {
    const citizen = await loginLegacyCitizen()

    const response = await citizen.agent
      .get("/api/v1/occurrences")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(response.status).toBe(428)

    expect(response.body).toMatchObject({
      error: {
        code: "CURRENT_AGREEMENT_REQUIRED"
      }
    })
  })

  it("deve registrar o aceite vigente e liberar o acesso imediatamente", async () => {
    const citizen = await loginLegacyCitizen()

    const acceptance = await citizen.agent
      .post("/api/v1/auth/agreements/current")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send(CURRENT_CITIZEN_REGISTRATION_AGREEMENT)

    expect(acceptance.status).toBe(200)

    expect(acceptance.body.meta.created).toBe(true)

    expect(acceptance.body.data).toMatchObject({
      termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

      privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

      responsibleUseVersion:
        CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion
    })

    expect(acceptance.body.data.acceptedAt).toBeTruthy()

    const me = await citizen.agent
      .get("/api/v1/auth/me")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(me.status).toBe(200)

    expect(me.body.agreement.required).toBe(false)

    expect(me.body.agreement.acceptedAt).toBeTruthy()

    const occurrences = await citizen.agent
      .get("/api/v1/occurrences")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(occurrences.status).toBe(200)

    const agreement = await prisma.userAgreement.findUnique({
      where: {
        userId_termsVersion_privacyVersion_responsibleUseVersion: {
          userId: citizen.user.id,

          termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

          privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

          responsibleUseVersion:
            CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion
        }
      }
    })

    expect(agreement).not.toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorUserId: citizen.user.id,

        action: "USER_AGREEMENT_ACCEPTED",

        entityType: "USER_AGREEMENT",

        entityId: agreement!.id
      }
    })

    expect(audit).not.toBeNull()
  })

  it("deve ser idempotente e não duplicar aceite nem auditoria", async () => {
    const citizen = await loginLegacyCitizen()

    const first = await citizen.agent
      .post("/api/v1/auth/agreements/current")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send(CURRENT_CITIZEN_REGISTRATION_AGREEMENT)

    const second = await citizen.agent
      .post("/api/v1/auth/agreements/current")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send(CURRENT_CITIZEN_REGISTRATION_AGREEMENT)

    expect(first.status).toBe(200)

    expect(first.body.meta.created).toBe(true)

    expect(second.status).toBe(200)

    expect(second.body.meta.created).toBe(false)

    const agreements = await prisma.userAgreement.count({
      where: {
        userId: citizen.user.id,

        termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

        privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

        responsibleUseVersion:
          CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion
      }
    })

    expect(agreements).toBe(1)

    const audits = await prisma.auditLog.count({
      where: {
        actorUserId: citizen.user.id,

        action: "USER_AGREEMENT_ACCEPTED"
      }
    })

    expect(audits).toBe(1)
  })

  it("deve rejeitar versão diferente da vigente", async () => {
    const citizen = await loginLegacyCitizen()

    const response = await citizen.agent
      .post("/api/v1/auth/agreements/current")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        ...CURRENT_CITIZEN_REGISTRATION_AGREEMENT,

        termsVersion: "versao-antiga"
      })

    expect(response.status).toBe(422)

    expect(response.body.error.code).toBe("VALIDATION_ERROR")

    const agreements = await prisma.userAgreement.count({
      where: {
        userId: citizen.user.id
      }
    })

    expect(agreements).toBe(0)
  })

  it("não deve exigir novo aceite de cidadão que já possui a versão vigente", async () => {
    const email = `current-${randomUUID()}@test.local`

    const agent = request.agent(app)

    const register = await agent.post("/api/v1/auth/register").send({
      name: "Cidadão Atual",

      email,

      password: PASSWORD,

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    expect(register.status).toBe(201)

    const login = await agent
      .post("/api/v1/auth/login")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)
      .send({
        email,

        password: PASSWORD
      })

    expect(login.status).toBe(200)

    expect(login.body.agreement.required).toBe(false)

    expect(login.body.agreement.acceptedAt).toBeTruthy()

    const occurrences = await agent
      .get("/api/v1/occurrences")
      .set(CLIENT_HEADER, CITIZEN_CLIENT)

    expect(occurrences.status).toBe(200)
  })
})
