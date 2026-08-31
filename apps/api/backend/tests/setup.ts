import { config } from "dotenv"

import { afterAll, beforeAll, beforeEach } from "vitest"

/*
 * Carrega o ambiente de testes antes de importar
 * Prisma, storage ou qualquer módulo da aplicação.
 */
config({
  path: ".env.test",
  override: true
})

if (!process.env.DATABASE_URL?.includes("kamara_test")) {
  throw new Error("DATABASE_URL de teste inválida.")
}

if (!process.env.STORAGE_BUCKET?.includes("test")) {
  throw new Error("STORAGE_BUCKET de teste inválido.")
}

/*
 * Imports dinâmicos são intencionais.
 *
 * src/config/env.ts e src/prisma/client.ts leem
 * process.env durante a importação.
 */
const { prisma } = await import("../src/prisma/client.js")

const { objectStorage } =
  await import("../src/integrations/storage/s3-storage.js")

const { resetDatabase } = await import("./helpers/database.js")

const { resetStorage } = await import("./helpers/storage.js")

beforeAll(async () => {
  await objectStorage.ensureBucket()
})

beforeEach(async () => {
  await resetDatabase()
  await resetStorage()
})

afterAll(async () => {
  await prisma.$disconnect()
})
