import { randomUUID } from "node:crypto"

import request from "supertest"

import { afterEach, describe, expect, it, vi } from "vitest"

import { app } from "../../src/app.js"

import { env } from "../../src/config/env.js"

import type { MailMessage } from "../../src/integrations/mail/mailer.js"

import { mailer } from "../../src/integrations/mail/smtp-mailer.js"

import {
  buildAppUrl,
  managerInviteEmail,
  passwordResetEmail
} from "../../src/integrations/mail/templates.js"

import {
  createAuthenticatedAdmin,
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

function spyOnMailer() {
  return vi.spyOn(mailer, "send").mockResolvedValue(undefined)
}

function sentMessages(spy: ReturnType<typeof spyOnMailer>) {
  return spy.mock.calls.map(([message]) => message as MailMessage)
}

/*
 * Pega o link do corpo em texto do e-mail e confere se ele aponta para
 * o frontend e a página esperados. Devolve o token do link.
 */
function tokenFromLink(message: MailMessage, appUrl: string, page: string) {
  const link = message.text.match(/https?:\/\/\S+/)?.[0]

  expect(link).toBeDefined()

  const url = new URL(link!)

  const expectedPage = new URL(page, `${appUrl.replace(/\/$/, "")}/`)

  expect(`${url.origin}${url.pathname}`).toBe(expectedPage.toString())

  // O mesmo link precisa estar no HTML.
  expect(message.html).toContain(url.toString().replaceAll("&", "&amp;"))

  const token = url.searchParams.get("token")

  expect(token).toBeTruthy()

  return token!
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("e-mail de redefinição de senha", () => {
  it("envia ao cidadão um link do app que redefine a senha", async () => {
    const sendSpy = spyOnMailer()

    const citizen = await createAuthenticatedCitizen({
      name: "Maria Cidadã"
    })

    const forgotResponse = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: citizen.credentials.email
      })

    expect(forgotResponse.status).toBe(202)

    const messages = sentMessages(sendSpy)

    expect(messages).toHaveLength(1)

    expect(messages[0]).toMatchObject({
      to: citizen.credentials.email,

      subject: expect.stringContaining("redefinição de senha")
    })

    expect(messages[0].text).toContain("Maria Cidadã")

    expect(messages[0].text).toContain("30 minutos")

    const token = tokenFromLink(
      messages[0],
      env.CITIZEN_APP_URL,
      "reset-password"
    )

    // Em NODE_ENV=test o token também volta na resposta. Tem que ser o mesmo.
    expect(token).toBe(forgotResponse.body.data.developmentResetToken)

    const resetResponse = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({
        token,

        password: "SenhaPeloEmail123!"
      })

    expect(resetResponse.status).toBe(200)

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .set("x-kamara-client", "CITIZEN_PWA")
      .send({
        email: citizen.credentials.email,

        password: "SenhaPeloEmail123!"
      })

    expect(loginResponse.status).toBe(200)
  })

  it("envia ao gestor um link do dashboard", async () => {
    const sendSpy = spyOnMailer()

    const manager = await createAuthenticatedManager()

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: manager.credentials.email
      })

    expect(response.status).toBe(202)

    const messages = sentMessages(sendSpy)

    expect(messages).toHaveLength(1)

    expect(messages[0].to).toBe(manager.credentials.email)

    tokenFromLink(messages[0], env.DASHBOARD_APP_URL, "reset-password")
  })

  it("não envia nada para e-mail sem conta e responde igual", async () => {
    const sendSpy = spyOnMailer()

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: `ninguem-${randomUUID()}@test.local`
      })

    expect(response.status).toBe(202)

    expect(response.body.data.message).toContain("solicitação de redefinição")

    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("responde 202 mesmo quando o envio do e-mail falha", async () => {
    vi.spyOn(mailer, "send").mockRejectedValue(new Error("SMTP fora do ar"))

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const citizen = await createAuthenticatedCitizen()

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({
        email: citizen.credentials.email
      })

    expect(response.status).toBe(202)

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("redefinição de senha"),
        expect.any(Error)
      )
    })
  })
})

describe("e-mail de convite de gestor", () => {
  it("envia ao convidado o link de aceite com o mesmo token do convite", async () => {
    const sendSpy = spyOnMailer()

    const admin = await createAuthenticatedAdmin()

    const email = `convidado-${randomUUID()}@test.local`

    const inviteResponse = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Convidado",

        email
      })

    expect(inviteResponse.status).toBe(201)

    const messages = sentMessages(sendSpy)

    expect(messages).toHaveLength(1)

    expect(messages[0]).toMatchObject({
      to: email,

      subject: expect.stringContaining("convite")
    })

    expect(messages[0].text).toContain("Gestor Convidado")

    expect(messages[0].text).toContain("24 horas")

    const token = tokenFromLink(
      messages[0],
      env.DASHBOARD_APP_URL,
      "accept-invite"
    )

    expect(token).toBe(inviteResponse.body.data.inviteToken)

    const acceptResponse = await request(app)
      .post("/api/v1/auth/manager-invites/accept")
      .send({
        token,

        password: "GestorPeloEmail123!"
      })

    expect(acceptResponse.status).toBe(201)
  })

  it("não envia e-mail quando o convite é recusado", async () => {
    const admin = await createAuthenticatedAdmin()

    const email = `repetido-${randomUUID()}@test.local`

    const firstResponse = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Repetido",

        email
      })

    expect(firstResponse.status).toBe(201)

    const sendSpy = spyOnMailer()

    const secondResponse = await admin.agent
      .post("/api/v1/admin/managers/invites")
      .send({
        name: "Gestor Repetido",

        email
      })

    expect(secondResponse.status).toBe(409)

    expect(sendSpy).not.toHaveBeenCalled()
  })
})

describe("modelos de e-mail", () => {
  it("escapa o nome no HTML", () => {
    const message = passwordResetEmail({
      to: "pessoa@test.local",

      name: '<img src=x onerror="alert(1)">',

      resetUrl: "http://localhost:3001/reset-password?token=abc",

      expiresInMinutes: 30
    })

    expect(message.html).not.toContain("<img")

    expect(message.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    )
  })

  it("usa uma saudação neutra quando a conta não tem nome", () => {
    const message = passwordResetEmail({
      to: "pessoa@test.local",

      name: null,

      resetUrl: "http://localhost:3001/reset-password?token=abc",

      expiresInMinutes: 30
    })

    expect(message.text.startsWith("Olá.")).toBe(true)
  })

  it("monta o link do convite com o token codificado", () => {
    const acceptUrl = buildAppUrl(
      "https://kamara.exemplo.org/painel",
      "accept-invite",
      {
        token: "a+b/c=d&e"
      }
    )

    expect(acceptUrl).toBe(
      "https://kamara.exemplo.org/painel/accept-invite?token=a%2Bb%2Fc%3Dd%26e"
    )

    expect(
      buildAppUrl("https://kamara.exemplo.org/painel/", "/accept-invite", {
        token: "x"
      })
    ).toBe("https://kamara.exemplo.org/painel/accept-invite?token=x")

    const message = managerInviteEmail({
      to: "gestor@test.local",

      name: "Gestor",

      acceptUrl,

      expiresInHours: 24
    })

    expect(message.text).toContain(acceptUrl)
  })
})
