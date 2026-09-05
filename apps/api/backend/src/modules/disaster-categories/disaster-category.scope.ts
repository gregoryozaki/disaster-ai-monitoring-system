export const OPERATIONAL_COBRADE_CODES = [
  "1.2.1.0.0",
  "1.2.2.0.0",
  "1.2.3.0.0",
  "1.4.1.3.1",
  "1.4.1.3.2",
  "2.3.1.1.0",
  "2.3.1.2.0"
] as const

const operationalCobradeCodeSet = new Set<string>(OPERATIONAL_COBRADE_CODES)

export function isOperationalCobradeCode(cobradeCode: string) {
  return operationalCobradeCodeSet.has(cobradeCode)
}
