import bcrypt from "bcryptjs"
import { Router } from "express"
import { z } from "zod"
import { auditLogs, categories, users } from "../data/store.js"
import { HttpError } from "../lib/http-error.js"
import { createId, nowIso } from "../lib/id.js"
import { authenticate, authorize } from "../middlewares/auth.js"
import { validateBody } from "../middlewares/validate.js"

const router = Router()
router.use(authenticate, authorize("ADMIN"))

const thresholdVersions: Array<Record<string, unknown>> = [
  {
    id: "thr-001",
    categoryId: "cat-fire",
    modelType: "visual",
    lowUpperBound: 0.5,
    mediumUpperBound: 0.75,
    version: 1,
    active: true,
    createdAt: nowIso()
  },
  {
    id: "thr-002",
    categoryId: "cat-flood",
    modelType: "text",
    lowUpperBound: 0.45,
    mediumUpperBound: 0.7,
    version: 1,
    active: true,
    createdAt: nowIso()
  }
]

router.get("/managers", (_req, res) => {
  res.json({
    data: users
      .filter((user) => user.role === "MANAGER" || user.role === "ADMIN")
      .map(({ passwordHash: _hash, ...user }) => user)
  })
})

router.post(
  "/managers/invites",
  validateBody(
    z.object({ email: z.string().email(), name: z.string().min(2) })
  ),
  async (req, res, next) => {
    try {
      if (users.some((user) => user.email === req.body.email))
        throw new HttpError(409, "E-mail ja cadastrado.", "EMAIL_EXISTS")
      const user = {
        id: createId("usr"),
        name: req.body.name,
        email: req.body.email,
        passwordHash: await bcrypt.hash(createId("tmp"), 10),
        role: "MANAGER" as const,
        status: "INVITED" as const,
        createdAt: nowIso()
      }
      users.push(user)
      auditLogs.push({
        id: createId("aud"),
        actorUserId: req.user!.id,
        action: "MANAGER_INVITED",
        entityType: "USER",
        entityId: user.id,
        createdAt: nowIso()
      })
      res.status(201).json({
        data: {
          id: user.id,
          email: user.email,
          status: user.status,
          inviteCode: "convite-demo"
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.patch(
  "/managers/:id/status",
  validateBody(z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) })),
  (req, res, next) => {
    const user = users.find(
      (item) => item.id === req.params.id && item.role === "MANAGER"
    )
    if (!user)
      return next(new HttpError(404, "Gestor nao encontrado.", "NOT_FOUND"))
    user.status = req.body.status
    auditLogs.push({
      id: createId("aud"),
      actorUserId: req.user!.id,
      action: "MANAGER_STATUS_CHANGED",
      entityType: "USER",
      entityId: user.id,
      afterData: { status: user.status },
      createdAt: nowIso()
    })
    const { passwordHash: _hash, ...publicUser } = user
    res.json({ data: publicUser })
  }
)

router.get("/categories", (_req, res) => {
  res.json({ data: categories })
})

router.post(
  "/categories",
  validateBody(
    z.object({
      cobradeCode: z.string().min(3),
      name: z.string().min(3),
      type: z.enum(["INCENDIO_QUEIMADA", "INUNDACAO_ALAGAMENTO"])
    })
  ),
  (req, res) => {
    const category = {
      id: createId("cat"),
      cobradeCode: req.body.cobradeCode,
      name: req.body.name,
      type: req.body.type,
      active: true
    }
    categories.push(category)
    auditLogs.push({
      id: createId("aud"),
      actorUserId: req.user!.id,
      action: "CATEGORY_CREATED",
      entityType: "DISASTER_CATEGORY",
      entityId: category.id,
      createdAt: nowIso()
    })
    res.status(201).json({ data: category })
  }
)

router.patch(
  "/categories/:id",
  validateBody(
    z.object({
      name: z.string().min(3).optional(),
      active: z.boolean().optional()
    })
  ),
  (req, res, next) => {
    const category = categories.find((item) => item.id === req.params.id)
    if (!category)
      return next(new HttpError(404, "Categoria nao encontrada.", "NOT_FOUND"))
    if (req.body.name) category.name = req.body.name
    if (typeof req.body.active === "boolean") category.active = req.body.active
    auditLogs.push({
      id: createId("aud"),
      actorUserId: req.user!.id,
      action: "CATEGORY_UPDATED",
      entityType: "DISASTER_CATEGORY",
      entityId: category.id,
      afterData: category,
      createdAt: nowIso()
    })
    res.json({ data: category })
  }
)

router.get("/confidence-thresholds", (_req, res) => {
  res.json({ data: thresholdVersions })
})

router.post(
  "/confidence-thresholds",
  validateBody(
    z.object({
      categoryId: z.string(),
      modelType: z.string(),
      lowUpperBound: z.number().min(0).max(1),
      mediumUpperBound: z.number().min(0).max(1)
    })
  ),
  (req, res, next) => {
    if (req.body.lowUpperBound >= req.body.mediumUpperBound)
      return next(
        new HttpError(
          400,
          "Faixas de confianca invalidas.",
          "INVALID_THRESHOLDS"
        )
      )
    thresholdVersions.forEach((item) => {
      if (
        item.categoryId === req.body.categoryId &&
        item.modelType === req.body.modelType
      )
        item.active = false
    })
    const version =
      thresholdVersions.filter(
        (item) =>
          item.categoryId === req.body.categoryId &&
          item.modelType === req.body.modelType
      ).length + 1
    const threshold = {
      id: createId("thr"),
      ...req.body,
      version,
      active: true,
      createdAt: nowIso()
    }
    thresholdVersions.push(threshold)
    auditLogs.push({
      id: createId("aud"),
      actorUserId: req.user!.id,
      action: "THRESHOLD_VERSIONED",
      entityType: "CONFIDENCE_THRESHOLD",
      entityId: threshold.id,
      afterData: threshold,
      createdAt: nowIso()
    })
    res.status(201).json({ data: threshold })
  }
)

router.get("/audit", (_req, res) => {
  res.json({ data: auditLogs })
})

export const adminRouter = router
