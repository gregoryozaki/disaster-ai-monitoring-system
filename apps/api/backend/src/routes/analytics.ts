import { Router } from "express"

import { authenticate, authorize } from "../middlewares/auth.js"

import { getAnalyticsSummary } from "../modules/analytics/analytics.service.js"

const router = Router()

router.use(authenticate, authorize("MANAGER", "ADMIN", "RESEARCHER"))

router.get(
  "/summary",

  async (_req, res, next) => {
    try {
      const summary = await getAnalyticsSummary()

      return res.json({
        data: summary
      })
    } catch (error) {
      next(error)
    }
  }
)

export const analyticsRouter = router
