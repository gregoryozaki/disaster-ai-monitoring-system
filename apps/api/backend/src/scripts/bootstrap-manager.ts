import bcrypt from "bcryptjs"

import { env } from "../config/env.js"
import { prisma } from "../prisma/client.js"

const email = process.env.KAMARA_MANAGER_EMAIL?.trim().toLowerCase()

const password = process.env.KAMARA_MANAGER_PASSWORD

const name = process.env.KAMARA_MANAGER_NAME?.trim() || "Gestor Kamara"

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Este bootstrap não pode ser executado com NODE_ENV=production."
    )
  }

  if (!email) {
    throw new Error("KAMARA_MANAGER_EMAIL é obrigatória.")
  }

  if (!password || password.length < 8) {
    throw new Error(
      "KAMARA_MANAGER_PASSWORD deve possuir pelo menos 8 caracteres."
    )
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  })

  const passwordHash = await bcrypt.hash(password, 12)

  if (!existingUser) {
    const manager = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "MANAGER",
        status: "ACTIVE"
      }
    })

    console.log(`Gestor criado com sucesso: ${manager.email}`)

    return
  }

  if (existingUser.role !== "MANAGER" && existingUser.role !== "ADMIN") {
    throw new Error(
      `Já existe um usuário com este e-mail e papel ${existingUser.role}. ` +
        "O bootstrap não altera automaticamente cidadãos ou pesquisadores."
    )
  }

  const manager = await prisma.user.update({
    where: {
      id: existingUser.id
    },

    data: {
      name,
      passwordHash,
      status: "ACTIVE",
      deactivatedAt: null
    }
  })

  console.log(`Gestor existente atualizado com sucesso: ${manager.email}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)

  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
