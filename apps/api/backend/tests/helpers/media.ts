import { createHash } from "node:crypto"

/*
 * PNG 1x1 válido.
 *
 * Mantemos a fixture em memória para os testes não dependerem
 * de arquivos existentes em outros workspaces do monorepo.
 */
export const testPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7wAAAABJRU5ErkJggg==",
  "base64"
)

export const testPngSha256 = createHash("sha256")
  .update(testPngBuffer)
  .digest("hex")
