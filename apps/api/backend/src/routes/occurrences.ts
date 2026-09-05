import { Router } from "express"

import { authenticate, authorize } from "../middlewares/auth.js"

import { validateBody, validateParams } from "../middlewares/validate.js"

import {
  answerInformationRequestController,
  listInformationRequestsController
} from "../modules/complements/complement.controller.js"

import {
  listCitizenOccurrenceMediaController,
  uploadInitialPhotoController
} from "../modules/media/media.controller.js"

import { uploadSinglePhoto } from "../modules/media/media.middleware.js"

import {
  createOccurrenceController,
  getOccurrenceController,
  listOccurrencesController
} from "../modules/occurrences/occurrence.controller.js"

import { createOccurrenceSchema } from "../modules/occurrences/occurrence.schema.js"

import { syncOccurrenceController } from "../modules/occurrences/occurrence-sync.controller.js"

import { syncOccurrenceSchema } from "../modules/occurrences/occurrence-sync.schema.js"

import {
  informationRequestParamsSchema,
  occurrenceIdParamsSchema
} from "../schemas/route-params.js"

const router = Router()

router.use(authenticate)

router.use(authorize("CITIZEN"))

/*
 * Registro online normal.
 */
router.post(
  "/",
  validateBody(createOccurrenceSchema),
  createOccurrenceController
)

/*
 * Registro criado anteriormente
 * no IndexedDB e sincronizado
 * quando a conectividade retorna.
 */
router.post(
  "/sync",
  validateBody(syncOccurrenceSchema),
  syncOccurrenceController
)

router.get("/", listOccurrencesController)

router.get(
  "/:id/media",
  validateParams(occurrenceIdParamsSchema),
  listCitizenOccurrenceMediaController
)

router.post(
  "/:id/media",
  validateParams(occurrenceIdParamsSchema),
  uploadSinglePhoto,
  uploadInitialPhotoController
)

router.get(
  "/:id/information-requests",
  validateParams(occurrenceIdParamsSchema),
  listInformationRequestsController
)

router.post(
  "/:id/information-requests/:requestId/complements",
  validateParams(informationRequestParamsSchema),
  uploadSinglePhoto,
  answerInformationRequestController
)

router.get(
  "/:id",
  validateParams(occurrenceIdParamsSchema),
  getOccurrenceController
)

export const occurrencesRouter = router
