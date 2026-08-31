import { Router } from "express"
import { z } from "zod"
import { auditLogs } from "../data/store.js"
import { createId, nowIso } from "../lib/id.js"
import { authenticate, authorize } from "../middlewares/auth.js"
import { validateBody } from "../middlewares/validate.js"

const router = Router()
router.use(authenticate, authorize("MANAGER", "ADMIN", "RESEARCHER"))

const exportJobs: Array<Record<string, unknown>> = []
const exportSchema = z.object({
  format: z.enum(["CSV", "JSON"]),
  filters: z.record(z.unknown()).optional()
})

router.post("/", validateBody(exportSchema), (req, res) => {
  const job = {
    id: createId("exp"),
    requestedById: req.user!.id,
    format: req.body.format,
    filters: req.body.filters ?? {},
    status: "COMPLETED",
    anonymized: true,
    fileRef: "/exports/mock-" + req.body.format.toLowerCase(),
    createdAt: nowIso(),
    completedAt: nowIso()
  }
  exportJobs.push(job)
  auditLogs.push({
    id: createId("aud"),
    actorUserId: req.user!.id,
    action: "EXPORT_REQUESTED",
    entityType: "EXPORT_JOB",
    entityId: job.id,
    createdAt: nowIso()
  })
  res.status(202).json({ data: job })
})

router.get("/:id", (req, res) => {
  const job = exportJobs.find((item) => item.id === req.params.id)
  res.json({ data: job ?? null })
})

export const exportsRouter = router
