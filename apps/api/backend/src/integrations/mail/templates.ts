import type { MailMessage } from "./mailer.js"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function buildAppUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string>
) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`

  const url = new URL(path.replace(/^\//, ""), base)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

function layout(
  title: string,
  paragraphs: string[],
  action: {
    label: string
    url: string
  }
) {
  const body = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")

  return `<!doctype html>
<html lang="pt-BR">
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
    <h2 style="color: #0f766e;">${escapeHtml(title)}</h2>
    ${body}
    <p>
      <a href="${escapeHtml(action.url)}"
         style="display: inline-block; padding: 10px 16px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 6px;">
        ${escapeHtml(action.label)}
      </a>
    </p>
    <p style="font-size: 12px; color: #6b7280;">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br />
      ${escapeHtml(action.url)}
    </p>
  </body>
</html>`
}

function greeting(name: string | null) {
  return name ? `Olá, ${name}.` : "Olá."
}

export function passwordResetEmail(input: {
  to: string
  name: string | null
  resetUrl: string
  expiresInMinutes: number
}): MailMessage {
  const subject = "Kamara: redefinição de senha"

  const intro =
    "Recebemos um pedido para redefinir a senha da sua conta no Kamara."

  const expiry = `O link vale por ${input.expiresInMinutes} minutos e só pode ser usado uma vez.`

  const ignore =
    "Se você não pediu a redefinição, ignore este e-mail. Sua senha continua a mesma."

  return {
    to: input.to,

    subject,

    text: [
      greeting(input.name),
      "",
      intro,
      "",
      `Para criar uma nova senha, acesse: ${input.resetUrl}`,
      "",
      expiry,
      ignore
    ].join("\n"),

    html: layout(
      "Redefinição de senha",
      [
        escapeHtml(greeting(input.name)),
        escapeHtml(intro),
        escapeHtml(expiry),
        escapeHtml(ignore)
      ],
      {
        label: "Criar nova senha",

        url: input.resetUrl
      }
    )
  }
}

export function managerInviteEmail(input: {
  to: string
  name: string
  acceptUrl: string
  expiresInHours: number
}): MailMessage {
  const subject = "Kamara: convite para gestor"

  const intro =
    "Você foi convidado para acessar o painel de gestão do Kamara como gestor."

  const expiry = `O convite vale por ${input.expiresInHours} horas. Ao aceitar, você vai definir a sua senha.`

  return {
    to: input.to,

    subject,

    text: [
      greeting(input.name),
      "",
      intro,
      "",
      `Para aceitar, acesse: ${input.acceptUrl}`,
      "",
      expiry
    ].join("\n"),

    html: layout(
      "Convite para gestor",
      [escapeHtml(greeting(input.name)), escapeHtml(intro), escapeHtml(expiry)],
      {
        label: "Aceitar convite",

        url: input.acceptUrl
      }
    )
  }
}
