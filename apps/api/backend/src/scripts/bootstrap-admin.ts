import bcrypt from "bcryptjs"

import { prisma } from "../prisma/client.js"

const email = process.env.KAMARA_ADMIN_EMAIL?.trim().toLowerCase()

const password = process.env.KAMARA_ADMIN_PASSWORD

const name = process.env.KAMARA_ADMIN_NAME?.trim() || "Administrador Kamara"

import { newPasswordSchema } from "../security/password-policy.js"

async function main() {
  if (!email) {
    throw new Error("KAMARA_ADMIN_EMAIL é obrigatória.")
  }

  const passwordResult = newPasswordSchema.safeParse(password)

  if (!passwordResult.success) {
    throw new Error(
      `KAMARA_ADMIN_PASSWORD não atende à política de senha: ${passwordResult.error.issues
        .map((issue) => issue.message)
        .join(" ")}`
    )
  }

  const validatedPassword = passwordResult.data
  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  })

  if (existingUser) {
    if (existingUser.role !== "ADMIN") {
      throw new Error(
        `Já existe um usuário com este e-mail e papel ${existingUser.role}. ` +
          "O bootstrap não promove usuários automaticamente para ADMIN."
      )
    }

    const passwordHash = await bcrypt.hash(validatedPassword, 12)

    const admin = await prisma.user.update({
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

    console.log(`Administrador existente atualizado: ${admin.email}`)

    return
  }

  const existingAdminCount = await prisma.user.count({
    where: {
      role: "ADMIN"
    }
  })

  if (existingAdminCount > 0) {
    throw new Error(
      "Já existe um administrador cadastrado. " +
        "O bootstrap inicial não criará outro ADMIN."
    )
  }

  const passwordHash = await bcrypt.hash(validatedPassword, 12)

  const admin = await prisma.user.create({
    data: {
      name,

      email,

      passwordHash,

      role: "ADMIN",

      status: "ACTIVE"
    }
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,

      action: "INITIAL_ADMIN_BOOTSTRAPPED",

      entityType: "USER",

      entityId: admin.id,

      afterData: {
        role: "ADMIN",

        status: "ACTIVE"
      }
    }
  })

  console.log(`Administrador inicial criado: ${admin.email}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)

  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
