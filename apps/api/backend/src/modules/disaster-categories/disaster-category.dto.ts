import type { DisasterCategory } from "../../generated/prisma/client.js"

export function toDisasterCategoryDto(category: DisasterCategory) {
  return {
    id: category.id,
    cobradeCode: category.cobradeCode,
    name: category.name,
    groupName: category.groupName
  }
}
