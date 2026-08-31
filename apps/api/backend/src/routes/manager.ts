import { Router } from "express"

import { z } from "zod"

import type { OccurrenceStatus } from "../generated/prisma/enums.js"

import { authenticate, authorize } from "../middlewares/auth.js"

import { validateBody, validateParams } from "../middlewares/validate.js"

import { listManagerOccurrenceMediaController } from "../modules/media/media.controller.js"

import { toOccurrenceDto } from "../modules/occurrences/occurrence.dto.js"

import {
  getManagerOccurrence,
  listManagerOccurrences
} from "../modules/validation/manager-occurrence.service.js"

import { validateOccurrenceController } from "../modules/validation/validation.controller.js"

import { validationSchema } from "../modules/validation/validation.schema.js"

import { occurrenceIdParamsSchema } from "../schemas/route-params.js"

const router = Router()

router.use(authenticate, authorize("MANAGER", "ADMIN"))

const occurrenceStatusSchema = z.enum([
  "DRAFT",
  "PENDING_SYNC",
  "SYNCED",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "CONFIRMED",
  "REJECTED"
])

router.get("/occurrences", async (req, res, next) => {
  try {
    let status: OccurrenceStatus | undefined

    if (typeof req.query.status === "string") {
      const parsed = occurrenceStatusSchema.safeParse(req.query.status)

      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: "INVALID_STATUS",

            message: "Status de ocorrência inválido."
          }
        })
      }

      status = parsed.data
    }

    const occurrences = await listManagerOccurrences(status)

    return res.json({
      data: occurrences.map(toOccurrenceDto)
    })
  } catch (error) {
    next(error)
  }
})

router.get(
  "/occurrences/:id/media",
  validateParams(occurrenceIdParamsSchema),
  listManagerOccurrenceMediaController
)

router.get(
  "/occurrences/:id",
  validateParams(occurrenceIdParamsSchema),
  async (req, res, next) => {
    try {
      const occurrence = await getManagerOccurrence(req.params.id)

      return res.json({
        data: toOccurrenceDto(occurrence)
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/occurrences/:id/validations",
  validateParams(occurrenceIdParamsSchema),
  validateBody(validationSchema),
  validateOccurrenceController
)

export const managerRouter = router
