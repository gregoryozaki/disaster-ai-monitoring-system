import bcrypt from "bcryptjs"
import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

import { prisma } from "../../src/prisma/client.js"

describe("Autenticação", () => {
  it("deve registrar um novo cidadão", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Cidadão Teste",
      email: "cidadao@test.local",
      password: "CidadaoTeste123!"
    })

    expect(response.status).toBe(201)

    expect(response.body.data).toMatchObject({
      name: "Cidadão Teste",
      email: "cidadao@test.local",
      role: "CITIZEN",
      status: "ACTIVE"
    })

    expect(response.body.data).not.toHaveProperty("passwordHash")

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
  })

  it("não deve permitir que o cadastro público escolha role", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Tentativa Gestor",
      email: "gestor-falso@test.local",
      password: "SenhaTeste123!",
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
      password: "LoginTeste123!"
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

    expect(cookieHeader).toContain("kamara_session=")

    expect(cookieHeader).toContain("HttpOnly")
  })

  it("deve permitir consultar /me usando a sessão autenticada", async () => {
    const agent = request.agent(app)

    await agent.post("/api/v1/auth/register").send({
      name: "Cidadão Me",
      email: "me@test.local",
      password: "UsuarioMe123!"
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
      password: "SenhaCorreta123!"
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
      password: "EmailTeste123!"
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
})
