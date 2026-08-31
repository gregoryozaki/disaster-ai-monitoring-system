import { Router } from "express"
import { categories, occurrences } from "../data/store.js"
import { authenticate, authorize } from "../middlewares/auth.js"

const router = Router()
router.use(authenticate, authorize("MANAGER", "ADMIN", "RESEARCHER"))

router.get("/summary", (_req, res) => {
  const total = occurrences.length
  const confirmed = occurrences.filter(
    (item) => item.status === "CONFIRMED"
  ).length
  const underReview = occurrences.filter(
    (item) => item.status === "UNDER_REVIEW"
  ).length
  const needsMoreInfo = occurrences.filter(
    (item) => item.status === "NEEDS_MORE_INFO"
  ).length
  const byStatus = occurrences.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})
  const byCategory = categories.map((category) => ({
    category,
    count: occurrences.filter(
      (item) => item.confirmedCategoryId === category.id
    ).length
  }))
  res.json({
    data: {
      total,
      confirmed,
      underReview,
      needsMoreInfo,
      confirmationRate: total ? confirmed / total : 0,
      byStatus,
      byCategory
    }
  })
})

export const analyticsRouter = router
