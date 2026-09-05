import { Router } from "express"

import { authenticate, authorize } from "../middlewares/auth.js"

import { validateBody, validateParams } from "../middlewares/validate.js"

import { toExportJobDto } from "../modules/exports/export.dto.js"

import {
  createExportSchema,
  exportIdParamsSchema
} from "../modules/exports/export.schema.js"

import {
  createExport,
  getExportContent,
  getExportJob
} from "../modules/exports/export.service.js"

const router = Router()

router.use(authenticate, authorize("MANAGER", "ADMIN", "RESEARCHER"))

router.post(
  "/",

  validateBody(createExportSchema),

  async (req, res, next) => {
    try {
      const job = await createExport(req.user!.id, req.body)

      return res.status(202).json({
        data: toExportJobDto(job)
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/:id",

  validateParams(exportIdParamsSchema),

  async (req, res, next) => {
    try {
      const job = await getExportJob(req.params.id, {
        id: req.user!.id,

        role: req.user!.role
      })

      return res.json({
        data: toExportJobDto(job)
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/:id/content",

  validateParams(exportIdParamsSchema),

  async (req, res, next) => {
    try {
      const result = await getExportContent(req.params.id, {
        id: req.user!.id,

        role: req.user!.role
      })

      res.setHeader(
        "Content-Type",
        result.content.contentType ??
          (result.job.format === "CSV"
            ? "text/csv; charset=utf-8"
            : "application/json; charset=utf-8")
      )

      res.setHeader("Content-Length", result.content.body.length.toString())

      res.setHeader("Cache-Control", "private, no-store")

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      )

      return res.status(200).send(result.content.body)
    } catch (error) {
      next(error)
    }
  }
)

export const exportsRouter = router
