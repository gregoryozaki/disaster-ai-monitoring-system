import { Router } from "express"
import { categories, predictions } from "../data/store.js"
import { authenticate, authorize } from "../middlewares/auth.js"

const router = Router()
router.use(authenticate, authorize("MANAGER", "ADMIN", "RESEARCHER"))

router.get("/", (req, res) => {
  const region =
    typeof req.query.region === "string"
      ? req.query.region.toLowerCase()
      : undefined
  const categoryId =
    typeof req.query.categoryId === "string" ? req.query.categoryId : undefined
  const data = predictions
    .filter((prediction) =>
      region ? prediction.regionName.toLowerCase().includes(region) : true
    )
    .filter((prediction) =>
      categoryId ? prediction.categoryId === categoryId : true
    )
    .map((prediction) => ({
      ...prediction,
      category:
        categories.find((category) => category.id === prediction.categoryId) ??
        null
    }))
  res.json({
    data,
    warning: "Previsoes sao experimentais e servem como apoio a decisao."
  })
})

export const predictionsRouter = router
