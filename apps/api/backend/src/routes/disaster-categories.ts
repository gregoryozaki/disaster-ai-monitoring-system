import { Router } from "express"

import { toDisasterCategoryDto } from "../modules/disaster-categories/disaster-category.dto.js"

import { listActiveDisasterCategories } from "../modules/disaster-categories/disaster-category.service.js"

const router = Router()

router.get("/", async (_req, res, next) => {
  try {
    const categories = await listActiveDisasterCategories()

    return res.json({
      data: categories.map(toDisasterCategoryDto)
    })
  } catch (error) {
    next(error)
  }
})

export const disasterCategoriesRouter = router
