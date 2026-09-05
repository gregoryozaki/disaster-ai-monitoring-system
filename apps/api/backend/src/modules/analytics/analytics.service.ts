import { prisma } from "../../prisma/client.js"

export async function getAnalyticsSummary() {
  const occurrences = await prisma.occurrence.findMany({
    where: {
      deletedAt: null
    },

    select: {
      status: true,
      confirmedCategoryId: true
    }
  })

  const total = occurrences.length

  const byStatus: Record<string, number> = {}

  const categoryCountById = new Map<string, number>()

  for (const occurrence of occurrences) {
    byStatus[occurrence.status] = (byStatus[occurrence.status] ?? 0) + 1

    if (occurrence.status === "CONFIRMED" && occurrence.confirmedCategoryId) {
      categoryCountById.set(
        occurrence.confirmedCategoryId,
        (categoryCountById.get(occurrence.confirmedCategoryId) ?? 0) + 1
      )
    }
  }

  const confirmed = byStatus.CONFIRMED ?? 0

  const underReview = byStatus.UNDER_REVIEW ?? 0

  const needsMoreInfo = byStatus.NEEDS_MORE_INFO ?? 0

  const confirmedCategoryIds = [...categoryCountById.keys()]

  const categories = await prisma.disasterCategory.findMany({
    where: {
      OR: [
        {
          active: true
        },

        ...(confirmedCategoryIds.length > 0
          ? [
              {
                id: {
                  in: confirmedCategoryIds
                }
              }
            ]
          : [])
      ]
    },

    select: {
      id: true,
      cobradeCode: true,
      name: true,
      groupName: true
    },

    orderBy: [
      {
        groupName: "asc"
      },
      {
        name: "asc"
      }
    ]
  })

  const byCategory = categories.map((category) => ({
    category,

    count: categoryCountById.get(category.id) ?? 0
  }))

  return {
    total,

    confirmed,

    underReview,

    needsMoreInfo,

    confirmationRate: total > 0 ? confirmed / total : 0,

    byStatus,

    byCategory
  }
}
