import { Router } from "express"

import { z } from "zod"

import { authenticate, authorize } from "../middlewares/auth.js"

import { validateBody, validateParams } from "../middlewares/validate.js"

import { listManagerOccurrenceMediaController } from "../modules/media/media.controller.js"

import {
  toManagerOccurrenceDetailDto,
  toManagerOccurrenceSummaryDto
} from "../modules/validation/manager-occurrence.dto.js"

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

function isValidCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A data deve estar no formato YYYY-MM-DD.")
  .refine(isValidCalendarDate, "A data informada é inválida.")

const managerOccurrenceQuerySchema = z
  .object({
    status: occurrenceStatusSchema.optional(),

    categoryId: z.string().uuid().optional(),

    humanRisk: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),

    dateFrom: calendarDateSchema.optional(),

    dateTo: calendarDateSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "A data final não pode ser anterior à data inicial."
      })
    }
  })

function startOfUtcDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function endOfUtcDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`)
}

router.get("/occurrences", async (req, res, next) => {
  try {
    const parsed = managerOccurrenceQuerySchema.safeParse(req.query)

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_MANAGER_FILTERS",

          message: "Os filtros informados são inválidos.",

          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      })
    }

    const occurrences = await listManagerOccurrences({
      status: parsed.data.status,

      categoryId: parsed.data.categoryId,

      humanRisk: parsed.data.humanRisk,

      dateFrom: parsed.data.dateFrom
        ? startOfUtcDay(parsed.data.dateFrom)
        : undefined,

      dateTo: parsed.data.dateTo ? endOfUtcDay(parsed.data.dateTo) : undefined
    })

    return res.json({
      data: occurrences.map(toManagerOccurrenceSummaryDto)
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
        data: toManagerOccurrenceDetailDto(occurrence)
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
