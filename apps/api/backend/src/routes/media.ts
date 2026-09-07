import { Router } from "express"

import {
  authenticate,
  requireCurrentCitizenAgreement
} from "../middlewares/auth.js"

import { validateParams } from "../middlewares/validate.js"

import { getMediaContentController } from "../modules/media/media.controller.js"

import { mediaIdParamsSchema } from "../schemas/route-params.js"

const router = Router()

router.use(authenticate)

router.use(requireCurrentCitizenAgreement)

router.get(
  "/:mediaId/content",
  validateParams(mediaIdParamsSchema),
  getMediaContentController
)

export const mediaRouter = router
