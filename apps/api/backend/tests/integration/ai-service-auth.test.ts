import { afterEach, describe, expect, it, vi } from "vitest"

import { env } from "../../src/config/env.js"

import { aiService } from "../../src/integrations/ai-service/http-ai-service.js"

const INTERNAL_KEY = "chave-interna-de-teste-123"

const originalKey = env.AI_SERVICE_API_KEY

function mockHealthyAIService() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: "ok",

        service: "kamara-ai"
      }),
      {
        status: 200,

        headers: {
          "content-type": "application/json"
        }
      }
    )
  )

  vi.stubGlobal("fetch", fetchMock)

  return fetchMock
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>) {
  const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]

  return options.headers as Record<string, string>
}

describe("autenticação interna com o serviço de IA", () => {
  afterEach(() => {
    env.AI_SERVICE_API_KEY = originalKey

    vi.unstubAllGlobals()

    vi.restoreAllMocks()
  })

  it("deve enviar X-Internal-Api-Key quando AI_SERVICE_API_KEY estiver configurada", async () => {
    env.AI_SERVICE_API_KEY = INTERNAL_KEY

    const fetchMock = mockHealthyAIService()

    await aiService.health()

    expect(sentHeaders(fetchMock)["x-internal-api-key"]).toBe(INTERNAL_KEY)
  })

  it("deve enviar a chave também na classificação", async () => {
    env.AI_SERVICE_API_KEY = INTERNAL_KEY

    const fetchMock = mockHealthyAIService()

    // A resposta mockada não segue o contrato de classificação;
    // aqui só interessa o cabeçalho enviado.
    await aiService.classify({ text: "rua alagada" }).catch(() => undefined)

    expect(sentHeaders(fetchMock)["x-internal-api-key"]).toBe(INTERNAL_KEY)
  })

  it("não deve enviar o cabeçalho quando a chave não estiver configurada", async () => {
    env.AI_SERVICE_API_KEY = undefined

    const fetchMock = mockHealthyAIService()

    await aiService.health()

    expect(sentHeaders(fetchMock)).not.toHaveProperty("x-internal-api-key")
  })
})
