import { prisma } from "../../prisma/client.js"

export function listAuditLogs() {
  return prisma.auditLog.findMany({
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },

    orderBy: [
      {
        createdAt: "desc"
      },
      {
        id: "desc"
      }
    ],

    take: 100
  })
}
