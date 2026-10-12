import { describe, expect, it } from "vitest"

import { approximateHourLabel } from "../src/lib/labels"

describe("hora aproximada das ocorrências públicas", () => {
  it("mostra o dia e a hora cheia no fuso informado", () => {
    expect(
      approximateHourLabel("2026-10-12T18:00:00.000Z", "America/Manaus")
    ).toBe("12/10, por volta das 14h")

    expect(
      approximateHourLabel("2026-10-13T03:00:00.000Z", "America/Sao_Paulo")
    ).toBe("13/10, por volta das 0h")
  })

  it("mostra os minutos em fusos de meia hora", () => {
    expect(
      approximateHourLabel("2026-10-12T18:00:00.000Z", "Asia/Kolkata")
    ).toBe("12/10, por volta das 23h30")

    expect(
      approximateHourLabel("2026-10-12T18:00:00.000Z", "Australia/Adelaide")
    ).toBe("13/10, por volta das 4h30")
  })
})
