import { Router } from "express"

import { authenticate, authorize } from "../middlewares/auth.js"

import { validateBody, validateParams } from "../middlewares/validate.js"

import {
  adminEntityIdParamsSchema,
  createAdminCategorySchema,
  createConfidenceThresholdSchema,
  updateAdminCategorySchema
} from "../modules/admin/admin.schema.js"

import {
  createAdministrativeCategory,
  listAdministrativeCategories,
  updateAdministrativeCategory
} from "../modules/admin/category-admin.service.js"

import {
  createConfidenceThreshold,
  listConfidenceThresholds
} from "../modules/admin/confidence-threshold-admin.service.js"

import { listAuditLogs } from "../modules/admin/audit-admin.service.js"

import {
  changeManagerStatus,
  listAdministrativeManagers
} from "../modules/admin/manager-admin.service.js"

import {
  createManagerInviteSchema,
  updateManagerStatusSchema
} from "../modules/manager-invites/manager-invite.schema.js"

import { createManagerInvite } from "../modules/manager-invites/manager-invite.service.js"

const router = Router()

router.use(authenticate, authorize("ADMIN"))

router.get(
  "/managers",

  async (_req, res, next) => {
    try {
      const managers = await listAdministrativeManagers()

      return res.json({
        data: managers
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/managers/invites",

  validateBody(createManagerInviteSchema),

  async (req, res, next) => {
    try {
      const result = await createManagerInvite(req.user!.id, req.body)

      return res.status(201).json({
        data: result
      })
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  "/managers/:id/status",

  validateParams(adminEntityIdParamsSchema),

  validateBody(updateManagerStatusSchema),

  async (req, res, next) => {
    try {
      const manager = await changeManagerStatus(
        req.user!.id,
        req.params.id,
        req.body
      )

      return res.json({
        data: manager
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/categories",

  async (_req, res, next) => {
    try {
      const categories = await listAdministrativeCategories()

      return res.json({
        data: categories
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/categories",

  validateBody(createAdminCategorySchema),

  async (req, res, next) => {
    try {
      const category = await createAdministrativeCategory(
        req.user!.id,
        req.body
      )

      return res.status(201).json({
        data: category
      })
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  "/categories/:id",

  validateParams(adminEntityIdParamsSchema),

  validateBody(updateAdminCategorySchema),

  async (req, res, next) => {
    try {
      const category = await updateAdministrativeCategory(
        req.user!.id,
        req.params.id,
        req.body
      )

      return res.json({
        data: category
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/confidence-thresholds",

  async (_req, res, next) => {
    try {
      const thresholds = await listConfidenceThresholds()

      return res.json({
        data: thresholds.map((threshold) => ({
          ...threshold,

          lowUpperBound: Number(threshold.lowUpperBound),

          mediumUpperBound: Number(threshold.mediumUpperBound)
        }))
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/confidence-thresholds",

  validateBody(createConfidenceThresholdSchema),

  async (req, res, next) => {
    try {
      const threshold = await createConfidenceThreshold(req.user!.id, req.body)

      return res.status(201).json({
        data: {
          ...threshold,

          lowUpperBound: Number(threshold.lowUpperBound),

          mediumUpperBound: Number(threshold.mediumUpperBound)
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get(
  "/audit",

  async (_req, res, next) => {
    try {
      const logs = await listAuditLogs()

      return res.json({
        data: logs
      })
    } catch (error) {
      next(error)
    }
  }
)

export const adminRouter = router
