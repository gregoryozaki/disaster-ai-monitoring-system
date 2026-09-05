import { Router } from "express"

import { HttpError } from "../lib/http-error.js"

import { authenticate, authorize } from "../middlewares/auth.js"

import { validateBody } from "../middlewares/validate.js"

import {
  createRiskPredictionSchema,
  listRiskPredictionsQuerySchema
} from "../modules/predictions/prediction.schema.js"

import {
  generateRiskPrediction,
  listRiskPredictions
} from "../modules/predictions/prediction.service.js"

const router = Router()

router.use(authenticate, authorize("MANAGER", "ADMIN", "RESEARCHER"))

router.get(
  "/",

  async (req, res, next) => {
    try {
      const parsed = listRiskPredictionsQuerySchema.safeParse({
        region:
          typeof req.query.region === "string" ? req.query.region : undefined,

        categoryId:
          typeof req.query.categoryId === "string"
            ? req.query.categoryId
            : undefined
      })

      if (!parsed.success) {
        throw new HttpError(
          400,
          "Filtros de previsão inválidos.",
          "INVALID_PREDICTION_FILTERS"
        )
      }

      const data = await listRiskPredictions(parsed.data)

      return res.json({
        data,

        warning:
          "Previsões são experimentais e servem apenas como apoio à decisão. Não constituem alerta oficial."
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/generate",

  validateBody(createRiskPredictionSchema),

  async (req, res, next) => {
    try {
      const prediction = await generateRiskPrediction(req.user!.id, req.body)

      return res.status(201).json({
        data: prediction,

        warning:
          "Previsão experimental. O baseline atual utiliza dados sintéticos e não constitui alerta oficial."
      })
    } catch (error) {
      next(error)
    }
  }
)

export const predictionsRouter = router
