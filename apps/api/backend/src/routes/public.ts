import { Router } from "express"

import { validateParams } from "../middlewares/validate.js"

import { toPublicOccurrenceDto } from "../modules/occurrences/public-occurrence.dto.js"

import { publicOccurrenceListQuerySchema } from "../modules/occurrences/public-occurrence.schema.js"

import {
  getPublicOccurrence,
  listPublicOccurrences
} from "../modules/occurrences/public-occurrence.service.js"

import { occurrenceIdParamsSchema } from "../schemas/route-params.js"

const router = Router()

router.get("/occurrences", async (req, res, next) => {
  try {
    const query = publicOccurrenceListQuerySchema.parse(req.query)

    const result = await listPublicOccurrences(query)

    return res.json({
      data: result.items.map((item) =>
        toPublicOccurrenceDto(item.occurrence, {
          distanceKm: item.distanceKm
        })
      ),

      meta: result.meta
    })
  } catch (error) {
    next(error)
  }
})

router.get(
  "/occurrences/:id",

  validateParams(occurrenceIdParamsSchema),

  async (req, res, next) => {
    try {
      const occurrence = await getPublicOccurrence(req.params.id)

      return res.json({
        data: toPublicOccurrenceDto(occurrence)
      })
    } catch (error) {
      next(error)
    }
  }
)

export const publicRouter = router
