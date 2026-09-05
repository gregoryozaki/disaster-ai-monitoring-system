import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import type { UpdateManagerStatusInput } from "../manager-invites/manager-invite.schema.js"

const managerPublicSelect = {
  id: true,

  name: true,

  email: true,

  role: true,

  status: true,

  createdAt: true,

  updatedAt: true,

  deactivatedAt: true
} as const

export function listAdministrativeManagers() {
  return prisma.user.findMany({
    where: {
      role: {
        in: ["MANAGER", "ADMIN"]
      }
    },

    select: managerPublicSelect,

    orderBy: [
      {
        role: "asc"
      },

      {
        createdAt: "desc"
      }
    ]
  })
}

export async function changeManagerStatus(
  adminId: string,
  managerId: string,
  input: UpdateManagerStatusInput
) {
  return prisma.$transaction(async (tx) => {
    const manager = await tx.user.findFirst({
      where: {
        id: managerId,

        role: "MANAGER"
      },

      select: managerPublicSelect
    })

    if (!manager) {
      throw new HttpError(404, "Gestor não encontrado.", "MANAGER_NOT_FOUND")
    }

    /*
     * Uma conta convidada não pode ser
     * ativada manualmente sem definir
     * a senha através do convite.
     */
    if (manager.status === "INVITED" && input.status === "ACTIVE") {
      throw new HttpError(
        409,
        "O gestor deve aceitar o convite antes de ser ativado.",
        "MANAGER_INVITE_REQUIRED"
      )
    }

    if (manager.status === input.status) {
      return manager
    }

    const updated = await tx.user.update({
      where: {
        id: manager.id
      },

      data: {
        status: input.status,

        deactivatedAt: input.status === "INACTIVE" ? new Date() : null
      },

      select: managerPublicSelect
    })

    await tx.auditLog.create({
      data: {
        actorUserId: adminId,

        action: "MANAGER_STATUS_CHANGED",

        entityType: "USER",

        entityId: manager.id,

        beforeData: {
          status: manager.status
        },

        afterData: {
          status: updated.status
        }
      }
    })

    return updated
  })
}
