import { prisma } from "../../prisma/client.js"

export function listActiveDisasterCategories() {
  return prisma.disasterCategory.findMany({
    where: {
      active: true
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
}
