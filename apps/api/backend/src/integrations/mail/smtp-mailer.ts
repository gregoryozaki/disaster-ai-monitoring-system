import nodemailer from "nodemailer"

import { env } from "../../config/env.js"

import type { MailMessage, Mailer } from "./mailer.js"

class SmtpMailer implements Mailer {
  private readonly transporter

  constructor(host: string) {
    this.transporter = nodemailer.createTransport({
      host,

      port: env.SMTP_PORT,

      secure: env.SMTP_SECURE,

      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? {
              user: env.SMTP_USER,

              pass: env.SMTP_PASSWORD
            }
          : undefined
    })
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.MAIL_FROM,

      ...message
    })
  }
}

/*
 * Usado sem SMTP_HOST e sempre nos testes. Nenhum e-mail é enviado.
 */
class DisabledMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    if (env.NODE_ENV !== "test") {
      console.warn(
        `E-mail não enviado (SMTP_HOST não configurada): "${message.subject}" para ${message.to}`
      )
    }
  }
}

/*
 * Nos testes nunca envia de verdade, mesmo que o .env local tenha
 * SMTP_HOST. Os testes espionam mailer.send.
 */
export const mailer: Mailer =
  env.SMTP_HOST && env.NODE_ENV !== "test"
    ? new SmtpMailer(env.SMTP_HOST)
    : new DisabledMailer()

/*
 * Envia sem bloquear a resposta HTTP. Assim o tempo de resposta não revela
 * se a conta existe, e uma falha no SMTP não derruba o fluxo principal.
 */
export function sendMailInBackground(message: MailMessage, context: string) {
  void mailer.send(message).catch((error: unknown) => {
    console.error(`Falha ao enviar e-mail (${context}):`, error)
  })
}
