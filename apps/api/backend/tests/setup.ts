import { config } from "dotenv"

import { afterAll, beforeAll, beforeEach } from "vitest"

/*
 * Carrega o ambiente exclusivo dos testes
 * antes de importar Prisma, storage ou
 * qualquer módulo da aplicação.
 */
config({
  path: ".env.test",
  override: true
})

/*
 * Proteções contra execução acidental dos
 * testes sobre recursos de desenvolvimento
 * ou produção.
 */
if (!process.env.DATABASE_URL?.includes("kamara_test")) {
  throw new Error(
    "DATABASE_URL de teste inválida. O banco deve conter 'kamara_test'."
  )
}

if (!process.env.STORAGE_BUCKET?.includes("test")) {
  throw new Error(
    "STORAGE_BUCKET de teste inválido. O bucket deve ser exclusivo de testes."
  )
}

if (process.env.AI_PREANALYSIS_ENABLED !== "false") {
  throw new Error(
    "AI_PREANALYSIS_ENABLED deve ser false no ambiente de testes."
  )
}

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
