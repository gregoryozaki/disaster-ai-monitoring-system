import express from "express"

import request from "supertest"

import { describe, expect, it } from "vitest"

import { app as apiApp } from "../../src/app.js"

import {
  createAccountActionLimiter,
  createCredentialAttemptLimiter
} from "../../src/middlewares/rate-limit.js"

/*
 * Os limitadores das rotas reais ficam desligados em NODE_ENV=test.
 * Aqui eles são montados em uma aplicação mínima, com trust proxy 0,
 * que é o padrão de TRUST_PROXY.
 */
function createAppWith(
  limiter: express.RequestHandler,
  status: number
): express.Express {
  const app = express()

  app.set("trust proxy", 0)

  app.post("/attempt", limiter, (_req, res) => {
    res.status(status).json({ ok: status < 400 })
  })

  return app
}

const silenceForwardedForWarning = {
  validate: {
    xForwardedForHeader: false
  }
}

describe("rate limit das rotas de autenticação", () => {
  it("a API não deve confiar em X-Forwarded-For por padrão", () => {
    expect(apiApp.get("trust proxy")).toBe(0)
  })

  it("deve bloquear com 429 depois de 10 tentativas de login que falharam", async () => {
    const app = createAppWith(createCredentialAttemptLimiter(), 401)

    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await request(app).post("/attempt")

      expect(response.status).toBe(401)
    }

    const blocked = await request(app).post("/attempt")

    expect(blocked.status).toBe(429)

    expect(blocked.body.error.code).toBe("TOO_MANY_ATTEMPTS")
  })

  it("não deve contar tentativas de login bem-sucedidas", async () => {
    const app = createAppWith(createCredentialAttemptLimiter(), 200)

    for (let attempt = 1; attempt <= 15; attempt++) {
      const response = await request(app).post("/attempt")

      expect(response.status).toBe(200)
    }
  })

  it("não deve permitir trocar de IP pelo X-Forwarded-For quando não há proxy confiável", async () => {
    const app = createAppWith(
      createCredentialAttemptLimiter(silenceForwardedForWarning),
      401
    )

    for (let attempt = 1; attempt <= 10; attempt++) {
      await request(app)
        .post("/attempt")
        .set("X-Forwarded-For", `203.0.113.${attempt}`)
    }

    const blocked = await request(app)
      .post("/attempt")
      .set("X-Forwarded-For", "203.0.113.99")

    expect(blocked.status).toBe(429)
  })

  it("deve limitar cadastro e redefinição de senha a 10 requisições na janela", async () => {
    const app = createAppWith(createAccountActionLimiter(), 202)

    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await request(app).post("/attempt")

      expect(response.status).toBe(202)
    }

    const blocked = await request(app).post("/attempt")

    expect(blocked.status).toBe(429)

    expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS")
  })
})
