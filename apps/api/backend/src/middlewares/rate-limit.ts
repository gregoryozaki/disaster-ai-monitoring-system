import rateLimit, { type Options } from "express-rate-limit"

import { env } from "../config/env.js"

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

const AUTH_RATE_LIMIT_MAX = 10

function tooManyRequestsBody(code: string, message: string) {
  return {
    error: {
      code,

      message
    }
  }
}

/*
 * Login e aceite de convite: conta somente as tentativas que falharam,
 * para dificultar força bruta sem atrapalhar quem acerta a senha.
 */
export function createCredentialAttemptLimiter(
  overrides: Partial<Options> = {}
) {
  return rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,

    limit: AUTH_RATE_LIMIT_MAX,

    skipSuccessfulRequests: true,

    standardHeaders: "draft-7",

    legacyHeaders: false,

    message: tooManyRequestsBody(
      "TOO_MANY_ATTEMPTS",
      "Muitas tentativas. Aguarde alguns minutos e tente novamente."
    ),

    ...overrides
  })
}

/*
 * Cadastro e fluxo de redefinição de senha: conta todas as requisições.
 */
export function createAccountActionLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,

    limit: AUTH_RATE_LIMIT_MAX,

    standardHeaders: "draft-7",

    legacyHeaders: false,

    message: tooManyRequestsBody(
      "TOO_MANY_REQUESTS",
      "Muitas solicitações. Aguarde alguns minutos e tente novamente."
    ),

    ...overrides
  })
}

/*
 * A suíte de integração cria muitos usuários pela API a partir do mesmo IP,
 * então os limitadores das rotas ficam desligados em NODE_ENV=test.
 * O comportamento deles é coberto em tests/integration/rate-limit.test.ts.
 */
const skipInTests = () => env.NODE_ENV === "test"

export const credentialAttemptLimiter = createCredentialAttemptLimiter({
  skip: skipInTests
})

export const accountActionLimiter = createAccountActionLimiter({
  skip: skipInTests
})
