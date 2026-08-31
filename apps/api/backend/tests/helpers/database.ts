import { prisma } from "../../src/prisma/client.js"

export async function resetDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? ""

  if (!databaseUrl.includes("kamara_test")) {
    throw new Error("Recusando limpar banco que não seja kamara_test.")
  }

  const tables = await prisma.$queryRaw<
    Array<{
      tablename: string
    }>
  >`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `

  if (tables.length === 0) {
    return
  }

  const tableList = tables
    .map(({ tablename }) => {
      const safeName = tablename.replaceAll('"', '""')

      return `"${safeName}"`
    })
    .join(", ")

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
  )
}
