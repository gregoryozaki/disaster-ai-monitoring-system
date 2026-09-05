import { HttpError } from "../../lib/http-error.js"

import { prisma } from "../../prisma/client.js"

import { isOperationalCobradeCode } from "../disaster-categories/disaster-category.scope.js"

import type {
  CreateAdminCategoryInput,
  UpdateAdminCategoryInput
} from "./admin.schema.js"

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

function categoryAuditData(category: {
  cobradeCode: string
  name: string
  groupName: string | null
  active: boolean
}) {
  return {
    cobradeCode: category.cobradeCode,
    name: category.name,
    groupName: category.groupName,
    active: category.active
  }
}

function assertOperationalActivation(cobradeCode: string, active: boolean) {
  if (active && !isOperationalCobradeCode(cobradeCode)) {
    throw new HttpError(
      422,
      "Esta categoria está fora do escopo operacional atual do protótipo.",
      "CATEGORY_OUTSIDE_OPERATIONAL_SCOPE"
    )
  }
}

export function listAdministrativeCategories() {
  return prisma.disasterCategory.findMany({
    orderBy: [
      {
        groupName: "asc"
      },
      {
        cobradeCode: "asc"
      }
    ]
  })
}

export async function createAdministrativeCategory(
  adminId: string,
  input: CreateAdminCategoryInput
) {
  const active = input.active ?? false

  assertOperationalActivation(input.cobradeCode, active)

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.disasterCategory.create({
        data: {
          cobradeCode: input.cobradeCode,
          name: input.name,
          groupName: input.groupName ?? null,
          active
        }
      })

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: "CATEGORY_CREATED",
          entityType: "DISASTER_CATEGORY",
          entityId: category.id,
          afterData: categoryAuditData(category)
        }
      })

      return category
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(
        409,
        "Já existe uma categoria com este código COBRADE.",
        "COBRADE_CODE_EXISTS"
      )
    }

    throw error
  }
}

export async function updateAdministrativeCategory(
  adminId: string,
  categoryId: string,
  input: UpdateAdminCategoryInput
) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.disasterCategory.findUnique({
      where: {
        id: categoryId
      }
    })

    if (!category) {
      throw new HttpError(
        404,
        "Categoria não encontrada.",
        "DISASTER_CATEGORY_NOT_FOUND"
      )
    }

    const targetActive = input.active ?? category.active

    assertOperationalActivation(category.cobradeCode, targetActive)

    const updated = await tx.disasterCategory.update({
      where: {
        id: category.id
      },

      data: {
        ...(input.name !== undefined
          ? {
              name: input.name
            }
          : {}),

        ...(input.groupName !== undefined
          ? {
              groupName: input.groupName
            }
          : {}),

        ...(input.active !== undefined
          ? {
              active: input.active
            }
          : {})
      }
    })

    await tx.auditLog.create({
      data: {
        actorUserId: adminId,
        action: "CATEGORY_UPDATED",
        entityType: "DISASTER_CATEGORY",
        entityId: category.id,

        beforeData: categoryAuditData(category),

        afterData: categoryAuditData(updated)
      }
    })

    return updated
  })
}
