import { Router } from "express"

import { validateParams } from "../middlewares/validate.js"

import { toPublicOccurrenceDto } from "../modules/occurrences/public-occurrence.dto.js"

import {
  getPublicOccurrence,
  listPublicOccurrences
} from "../modules/occurrences/public-occurrence.service.js"

import { occurrenceIdParamsSchema } from "../schemas/route-params.js"

const router = Router()

router.get("/occurrences", async (_req, res, next) => {
  try {
    const occurrences = await listPublicOccurrences()

    return res.json({
      data: occurrences.map(toPublicOccurrenceDto)
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
