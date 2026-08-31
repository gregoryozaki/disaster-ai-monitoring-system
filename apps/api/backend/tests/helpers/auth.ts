import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"
import request from "supertest"

import { app } from "../../src/app.js"
import { prisma } from "../../src/prisma/client.js"

interface TestUserOptions {
  name?: string
  email?: string
  password?: string
}

export async function createAuthenticatedCitizen(
  options: TestUserOptions = {}
) {
  const name = options.name ?? "Cidadão Teste"

  const email = options.email ?? `citizen-${randomUUID()}@test.local`

  const password = options.password ?? "CidadaoTeste123!"

  const agent = request.agent(app)

  const registerResponse = await agent.post("/api/v1/auth/register").send({
    name,
    email,
    password
  })

  if (registerResponse.status !== 201) {
    throw new Error(
      `Falha ao criar cidadão de teste: ${JSON.stringify(
        registerResponse.body
      )}`
    )
  }

  const loginResponse = await agent.post("/api/v1/auth/login").send({
    email,
    password
  })

  if (loginResponse.status !== 200) {
    throw new Error(
      `Falha ao autenticar cidadão de teste: ${JSON.stringify(
        loginResponse.body
      )}`
    )
  }

  return {
    agent,
    user: loginResponse.body.data,
    credentials: {
      email,
      password
    }
  }
}

export async function createAuthenticatedManager(
  options: TestUserOptions = {}
) {
  const name = options.name ?? "Gestor Teste"

  const email = options.email ?? `manager-${randomUUID()}@test.local`

  const password = options.password ?? "ManagerTeste123!"

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "MANAGER",
      status: "ACTIVE"
    }
  })

  const agent = request.agent(app)

  const loginResponse = await agent.post("/api/v1/auth/login").send({
    email,
    password
  })

  if (loginResponse.status !== 200) {
    throw new Error(
      `Falha ao autenticar gestor de teste: ${JSON.stringify(
        loginResponse.body
      )}`
    )
  }

  return {
    agent,
    user,
    credentials: {
      email,
      password
    }
  }
}
