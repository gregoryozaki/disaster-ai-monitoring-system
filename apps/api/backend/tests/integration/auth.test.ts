import { createHash } from "node:crypto"

import bcrypt from "bcryptjs"

import request from "supertest"

import { describe, expect, it } from "vitest"

import { CURRENT_CITIZEN_REGISTRATION_AGREEMENT } from "@kamara/shared-types"

import { app } from "../../src/app.js"

import { prisma } from "../../src/prisma/client.js"

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

describe("Autenticação", () => {
  it("deve registrar um novo cidadão e persistir o aceite versionado", async () => {
    const beforeRegistration = Date.now()

    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Teste",

      email: "cidadao@test.local",

      password: "CidadaoTeste123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const afterRegistration = Date.now()

    expect(response.status).toBe(201)

    expect(response.body.data).toMatchObject({
      name: "Cidadão Teste",

      email: "cidadao@test.local",

      role: "CITIZEN",

      status: "ACTIVE"
    })

    expect(response.body.data).not.toHaveProperty("passwordHash")

    expect(response.body.data).not.toHaveProperty("agreement")

    const storedUser = await prisma.user.findUnique({
      where: {
        email: "cidadao@test.local"
      }
    })

    expect(storedUser).not.toBeNull()

    expect(storedUser?.role).toBe("CITIZEN")

    expect(storedUser?.status).toBe("ACTIVE")

    expect(storedUser?.passwordHash).not.toBe("CidadaoTeste123!")

    const passwordMatches = await bcrypt.compare(
      "CidadaoTeste123!",
      storedUser!.passwordHash
    )

    expect(passwordMatches).toBe(true)

    const agreement = await prisma.userAgreement.findFirst({
      where: {
        userId: storedUser!.id
      }
    })

    expect(agreement).not.toBeNull()

    expect(agreement).toMatchObject({
      userId: storedUser!.id,

      termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

      privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

      responsibleUseVersion:
        CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion
    })

    expect(agreement!.acceptedAt).toBeInstanceOf(Date)

    expect(agreement!.acceptedAt.getTime()).toBeGreaterThanOrEqual(
      beforeRegistration - 1_000
    )

    expect(agreement!.acceptedAt.getTime()).toBeLessThanOrEqual(
      afterRegistration + 1_000
    )

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorUserId: storedUser!.id,

        action: "USER_AGREEMENT_ACCEPTED",

        entityType: "USER_AGREEMENT",

        entityId: agreement!.id
      }
    })

    expect(audit).not.toBeNull()

    expect(audit?.metadata).toMatchObject({
      termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

      privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

      responsibleUseVersion:
        CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion
    })
  })

  it("não deve permitir cadastro sem aceite dos documentos vigentes", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Sem Aceite",

      email: "sem-aceite@test.local",

      password: "SemAceiteTeste123!"
    })

    expect(response.status).toBe(422)

    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    })

    const user = await prisma.user.findUnique({
      where: {
        email: "sem-aceite@test.local"
      }
    })

    expect(user).toBeNull()

    const agreements = await prisma.userAgreement.count()

    expect(agreements).toBe(0)
  })

  it("não deve permitir cadastro com aceite incompleto", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Aceite Incompleto",

        email: "aceite-incompleto@test.local",

        password: "AceiteIncompleto123!",

        agreement: {
          termsAccepted: true,

          privacyAccepted: true,

          termsVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.termsVersion,

          privacyVersion: CURRENT_CITIZEN_REGISTRATION_AGREEMENT.privacyVersion,

          responsibleUseVersion:
            CURRENT_CITIZEN_REGISTRATION_AGREEMENT.responsibleUseVersion
        }
      })

    expect(response.status).toBe(422)

    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    })

    const user = await prisma.user.findUnique({
      where: {
        email: "aceite-incompleto@test.local"
      }
    })

    expect(user).toBeNull()
  })

  it("não deve permitir cadastro com versão de termos diferente da vigente", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Versão Antiga",

        email: "versao-antiga@test.local",

        password: "VersaoAntigaTeste123!",

        agreement: {
          ...CURRENT_CITIZEN_REGISTRATION_AGREEMENT,

          termsVersion: "2026-09-06.1"
        }
      })

    expect(response.status).toBe(422)

    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    })

    const user = await prisma.user.findUnique({
      where: {
        email: "versao-antiga@test.local"
      }
    })

    expect(user).toBeNull()
  })

  it("não deve permitir que o cadastro público escolha role", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Tentativa Gestor",

      email: "gestor-falso@test.local",

      password: "SenhaTeste123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT,

      role: "MANAGER"
    })

    expect(response.status).toBe(422)

    expect(response.body.error.code).toBe("VALIDATION_ERROR")

    const user = await prisma.user.findUnique({
      where: {
        email: "gestor-falso@test.local"
      }
    })

    expect(user).toBeNull()
  })

  it("não deve permitir que o cadastro público escolha status", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Status Indevido",

      email: "status-falso@test.local",

      password: "SenhaTeste123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT,

      status: "INACTIVE"
    })

    expect(response.status).toBe(422)

    expect(response.body.error.code).toBe("VALIDATION_ERROR")

    const user = await prisma.user.findUnique({
      where: {
        email: "status-falso@test.local"
      }
    })

    expect(user).toBeNull()
  })

  it("deve autenticar um cidadão e criar cookie de sessão", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Login",

      email: "login@test.local",

      password: "LoginTeste123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "login@test.local",

      password: "LoginTeste123!"
    })

    expect(response.status).toBe(200)

    expect(response.body.data).toMatchObject({
      email: "login@test.local",

      role: "CITIZEN",

      status: "ACTIVE"
    })

    const cookies = response.headers["set-cookie"]

    expect(cookies).toBeDefined()

    const cookieHeader = Array.isArray(cookies)
      ? cookies.join(";")
      : String(cookies)

    expect(cookieHeader).toContain("kamara_citizen_session=")

    expect(cookieHeader).toContain("HttpOnly")
  })

  it("deve permitir consultar /me usando a sessão autenticada", async () => {
    const agent = request.agent(app)

    await agent.post("/api/v1/auth/register").send({
      name: "Cidadão Me",

      email: "me@test.local",

      password: "UsuarioMe123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const loginResponse = await agent.post("/api/v1/auth/login").send({
      email: "me@test.local",

      password: "UsuarioMe123!"
    })

    expect(loginResponse.status).toBe(200)

    const meResponse = await agent.get("/api/v1/auth/me")

    expect(meResponse.status).toBe(200)

    expect(meResponse.body.data).toMatchObject({
      name: "Cidadão Me",

      email: "me@test.local",

      role: "CITIZEN",

      status: "ACTIVE"
    })
  })

  it("deve rejeitar /me sem autenticação", async () => {
    const response = await request(app).get("/api/v1/auth/me")

    expect(response.status).toBe(401)

    expect(response.body).toMatchObject({
      error: {
        code: "AUTH_REQUIRED"
      }
    })
  })

  it("deve rejeitar login com senha incorreta", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Senha",

      email: "senha@test.local",

      password: "SenhaCorreta123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "senha@test.local",

      password: "SenhaErrada123!"
    })

    expect(response.status).toBe(401)

    expect(response.body.error.code).toBe("INVALID_CREDENTIALS")
  })

  it("deve normalizar o email cadastrado", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Email Teste",

      email: "  EMAIL.TESTE@TEST.LOCAL  ",

      password: "EmailTeste123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    expect(response.status).toBe(201)

    expect(response.body.data.email).toBe("email.teste@test.local")

    const storedUser = await prisma.user.findUnique({
      where: {
        email: "email.teste@test.local"
      }
    })

    expect(storedUser).not.toBeNull()
  })

  it("deve criar token de redefinição armazenando somente seu hash", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Recuperação",

      email: "recuperacao@test.local",

      password: "SenhaOriginal123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: "recuperacao@test.local"
      })

    expect(response.status).toBe(202)

    expect(response.body.data.message).toContain("solicitação de redefinição")

    const rawToken = response.body.data.developmentResetToken

    expect(typeof rawToken).toBe("string")

    expect(rawToken.length).toBeGreaterThanOrEqual(10)

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: "recuperacao@test.local"
      }
    })

    const storedToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id
      },

      orderBy: {
        createdAt: "desc"
      }
    })

    expect(storedToken).not.toBeNull()

    expect(storedToken?.tokenHash).not.toBe(rawToken)

    expect(storedToken?.tokenHash).toBe(sha256(rawToken))

    expect(storedToken?.usedAt).toBeNull()

    expect(storedToken!.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorUserId: user.id,

        action: "PASSWORD_RESET_REQUESTED",

        entityType: "PASSWORD_RESET_TOKEN",

        entityId: storedToken!.id
      }
    })

    expect(audit).not.toBeNull()
  })

  it("não deve revelar se um e-mail inexistente possui conta", async () => {
    const before = await prisma.passwordResetToken.count()

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: "conta-inexistente@test.local"
      })

    expect(response.status).toBe(202)

    expect(response.body.data.message).toContain("solicitação de redefinição")

    expect(response.body.data).not.toHaveProperty("developmentResetToken")

    const after = await prisma.passwordResetToken.count()

    expect(after).toBe(before)
  })

  it("não deve criar token de redefinição para usuário inativo", async () => {
    const passwordHash = await bcrypt.hash("UsuarioInativo123!", 12)

    const user = await prisma.user.create({
      data: {
        name: "Usuário Inativo",

        email: "usuario-inativo-reset@test.local",

        passwordHash,

        role: "CITIZEN",

        status: "INACTIVE"
      }
    })

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: user.email
      })

    expect(response.status).toBe(202)

    expect(response.body.data).not.toHaveProperty("developmentResetToken")

    const tokens = await prisma.passwordResetToken.count({
      where: {
        userId: user.id
      }
    })

    expect(tokens).toBe(0)
  })

  it("deve invalidar token anterior quando nova recuperação for solicitada", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Tokens",

      email: "multiplos-tokens@test.local",

      password: "SenhaTokens123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const firstRequest = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: "multiplos-tokens@test.local"
      })

    expect(firstRequest.status).toBe(202)

    const firstRawToken = firstRequest.body.data.developmentResetToken

    const secondRequest = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: "multiplos-tokens@test.local"
      })

    expect(secondRequest.status).toBe(202)

    const secondRawToken = secondRequest.body.data.developmentResetToken

    expect(secondRawToken).not.toBe(firstRawToken)

    const firstStoredToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash: sha256(firstRawToken)
      }
    })

    const secondStoredToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash: sha256(secondRawToken)
      }
    })

    expect(firstStoredToken).not.toBeNull()

    expect(firstStoredToken?.usedAt).not.toBeNull()

    expect(secondStoredToken).not.toBeNull()

    expect(secondStoredToken?.usedAt).toBeNull()

    const oldTokenResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token: firstRawToken,

        password: "NovaSenhaTokens123!"
      })

    expect(oldTokenResponse.status).toBe(400)

    expect(oldTokenResponse.body.error.code).toBe(
      "INVALID_PASSWORD_RESET_TOKEN"
    )

    const currentTokenResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token: secondRawToken,

        password: "NovaSenhaTokens123!"
      })

    expect(currentTokenResponse.status).toBe(200)
  })

  it("deve redefinir a senha, permitir login com a nova senha e impedir reutilização do token", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Nova Senha",

      email: "nova-senha@test.local",

      password: "SenhaAntiga123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const forgotResponse = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: "nova-senha@test.local"
      })

    expect(forgotResponse.status).toBe(202)

    const rawToken = forgotResponse.body.data.developmentResetToken

    const resetResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token: rawToken,

        password: "SenhaNova456!"
      })

    expect(resetResponse.status).toBe(200)

    expect(resetResponse.body.data.message).toBe(
      "Senha redefinida com sucesso. Entre novamente com a nova senha."
    )

    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "nova-senha@test.local",

        password: "SenhaAntiga123!"
      })

    expect(oldPasswordLogin.status).toBe(401)

    expect(oldPasswordLogin.body.error.code).toBe("INVALID_CREDENTIALS")

    const newPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "nova-senha@test.local",

        password: "SenhaNova456!"
      })

    expect(newPasswordLogin.status).toBe(200)

    const reusedTokenResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token: rawToken,

        password: "OutraSenha789!"
      })

    expect(reusedTokenResponse.status).toBe(400)

    expect(reusedTokenResponse.body.error.code).toBe(
      "INVALID_PASSWORD_RESET_TOKEN"
    )

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: "nova-senha@test.local"
      }
    })

    const token = await prisma.passwordResetToken.findUniqueOrThrow({
      where: {
        tokenHash: sha256(rawToken)
      }
    })

    expect(token.usedAt).not.toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorUserId: user.id,

        action: "PASSWORD_RESET_COMPLETED",

        entityType: "USER",

        entityId: user.id
      }
    })

    expect(audit).not.toBeNull()
  })

  it("deve rejeitar token de redefinição expirado", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Token Expirado",

      email: "token-expirado@test.local",

      password: "SenhaExpirada123!",

      agreement: CURRENT_CITIZEN_REGISTRATION_AGREEMENT
    })

    const forgotResponse = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: "token-expirado@test.local"
      })

    expect(forgotResponse.status).toBe(202)

    const rawToken = forgotResponse.body.data.developmentResetToken

    await prisma.passwordResetToken.update({
      where: {
        tokenHash: sha256(rawToken)
      },

      data: {
        expiresAt: new Date(Date.now() - 60_000)
      }
    })

    const resetResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token: rawToken,

        password: "NovaSenhaExpirada123!"
      })

    expect(resetResponse.status).toBe(400)

    expect(resetResponse.body.error.code).toBe("INVALID_PASSWORD_RESET_TOKEN")
  })
})
