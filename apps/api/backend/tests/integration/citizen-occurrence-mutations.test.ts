import {
  describe,
  expect,
  it
} from "vitest"

import { prisma } from "../../src/prisma/client.js"

import {
  createAuthenticatedCitizen,
  createAuthenticatedManager
} from "../helpers/auth.js"

import {
  buildOccurrencePayload,
  createTestDisasterCategory
} from "../helpers/fixtures.js"

async function createOccurrenceForCitizen() {
  const citizen =
    await createAuthenticatedCitizen()

  const response = await citizen.agent
    .post("/api/v1/occurrences")
    .send(
      buildOccurrencePayload({
        description:
          "Ocorrência criada para teste de edição."
      })
    )

  expect(response.status).toBe(201)

  return {
    citizen,
    occurrenceId:
      response.body.data.id
  }
}

describe(
  "Edição e cancelamento de ocorrência pelo cidadão",
  () => {
    it(
      "deve informar permissões para ocorrência nova sem intervenção do gestor",
      async () => {
        const {
          citizen,
          occurrenceId
        } =
          await createOccurrenceForCitizen()

        const response =
          await citizen.agent.get(
            `/api/v1/occurrences/${occurrenceId}`
          )

        expect(response.status).toBe(200)

        expect(
          response.body.meta.permissions
        ).toEqual({
          canEdit: true,
          canDelete: true
        })
      }
    )

    it(
      "deve permitir editar a própria ocorrência antes da intervenção do gestor",
      async () => {
        const {
          citizen,
          occurrenceId
        } =
          await createOccurrenceForCitizen()

        const before =
          await prisma.occurrence
            .findUniqueOrThrow({
              where: {
                id: occurrenceId
              }
            })

        const response =
          await citizen.agent
            .patch(
              `/api/v1/occurrences/${occurrenceId}`
            )
            .send({
              description:
                "A água subiu e cobriu parte da rua.",

              urgency: "CRITICAL",

              humanRisk: true,

              latitude: -3.1185,

              longitude: -60.0205,

              locationSource:
                "MANUAL",

              locationAccuracyM:
                null
            })

        expect(response.status).toBe(200)

        expect(
          response.body.data
        ).toMatchObject({
          id: occurrenceId,

          description:
            "A água subiu e cobriu parte da rua.",

          urgency: "CRITICAL",

          humanRisk: true,

          status: "UNDER_REVIEW",

          location: {
            latitude: -3.1185,
            longitude: -60.0205,
            source: "MANUAL",
            accuracyM: null
          }
        })

        expect(
          response.body.meta.permissions
        ).toEqual({
          canEdit: true,
          canDelete: true
        })

        const after =
          await prisma.occurrence
            .findUniqueOrThrow({
              where: {
                id: occurrenceId
              }
            })

        expect(
          after.reportedAt.toISOString()
        ).toBe(
          before.reportedAt.toISOString()
        )

        expect(
          after.reporterId
        ).toBe(
          citizen.user.id
        )

        const audit =
          await prisma.auditLog.findFirst({
            where: {
              actorUserId:
                citizen.user.id,

              entityId:
                occurrenceId,

              action:
                "CITIZEN_OCCURRENCE_UPDATED"
            }
          })

        expect(audit).not.toBeNull()
      }
    )

    it(
      "não deve permitir editar ocorrência pertencente a outro cidadão",
      async () => {
        const owner =
          await createOccurrenceForCitizen()

        const otherCitizen =
          await createAuthenticatedCitizen()

        const response =
          await otherCitizen.agent
            .patch(
              `/api/v1/occurrences/${owner.occurrenceId}`
            )
            .send({
              description:
                "Tentativa indevida."
            })

        expect(response.status).toBe(404)

        expect(
          response.body.error.code
        ).toBe(
          "OCCURRENCE_NOT_FOUND"
        )
      }
    )

    it(
      "deve bloquear edição e cancelamento depois de solicitação de complemento, mesmo após voltar para UNDER_REVIEW",
      async () => {
        const {
          citizen,
          occurrenceId
        } =
          await createOccurrenceForCitizen()

        const manager =
          await createAuthenticatedManager()

        const requestResponse =
          await manager.agent
            .post(
              `/api/v1/manager/occurrences/${occurrenceId}/validations`
            )
            .send({
              decision:
                "REQUEST_MORE_INFO",

              informationRequestMessage:
                "Envie mais detalhes sobre o nível da água."
            })

        expect(
          requestResponse.status
        ).toBe(201)

        expect(
          requestResponse.body.data
            .occurrence.status
        ).toBe(
          "NEEDS_MORE_INFO"
        )

        const requestId =
          requestResponse.body.data
            .informationRequest.id

        const complementResponse =
          await citizen.agent
            .post(
              `/api/v1/occurrences/${occurrenceId}/information-requests/${requestId}/complements`
            )
            .field(
              "text",
              "A água chegou aproximadamente à metade da roda dos veículos."
            )

        expect(
          complementResponse.status
        ).toBe(201)

        const occurrence =
          await prisma.occurrence
            .findUniqueOrThrow({
              where: {
                id: occurrenceId
              }
            })

        /*
         * Esta é a situação crítica:
         *
         * o status voltou a UNDER_REVIEW,
         * mas já houve intervenção humana.
         */
        expect(
          occurrence.status
        ).toBe(
          "UNDER_REVIEW"
        )

        const detailResponse =
          await citizen.agent.get(
            `/api/v1/occurrences/${occurrenceId}`
          )

        expect(
          detailResponse.body.meta.permissions
        ).toEqual({
          canEdit: false,
          canDelete: false
        })

        const editResponse =
          await citizen.agent
            .patch(
              `/api/v1/occurrences/${occurrenceId}`
            )
            .send({
              description:
                "Tentativa de alterar o relato original."
            })

        expect(
          editResponse.status
        ).toBe(409)

        expect(
          editResponse.body.error.code
        ).toBe(
          "OCCURRENCE_LOCKED"
        )

        const deleteResponse =
          await citizen.agent.delete(
            `/api/v1/occurrences/${occurrenceId}`
          )

        expect(
          deleteResponse.status
        ).toBe(409)

        expect(
          deleteResponse.body.error.code
        ).toBe(
          "OCCURRENCE_LOCKED"
        )
      }
    )

    it(
      "não deve permitir cancelar uma ocorrência já confirmada pelo gestor",
      async () => {
        const {
          citizen,
          occurrenceId
        } =
          await createOccurrenceForCitizen()

        const manager =
          await createAuthenticatedManager()

        const category =
          await createTestDisasterCategory()

        const validationResponse =
          await manager.agent
            .post(
              `/api/v1/manager/occurrences/${occurrenceId}/validations`
            )
            .send({
              decision: "CONFIRM",

              finalCategoryId:
                category.id
            })

        expect(
          validationResponse.status
        ).toBe(201)

        const deleteResponse =
          await citizen.agent.delete(
            `/api/v1/occurrences/${occurrenceId}`
          )

        expect(
          deleteResponse.status
        ).toBe(409)

        expect(
          deleteResponse.body.error.code
        ).toBe(
          "OCCURRENCE_LOCKED"
        )

        const occurrence =
          await prisma.occurrence
            .findUniqueOrThrow({
              where: {
                id: occurrenceId
              }
            })

        expect(
          occurrence.deletedAt
        ).toBeNull()

        expect(
          occurrence.status
        ).toBe(
          "CONFIRMED"
        )
      }
    )

    it(
      "deve realizar cancelamento lógico antes da intervenção do gestor",
      async () => {
        const {
          citizen,
          occurrenceId
        } =
          await createOccurrenceForCitizen()

        const deleteResponse =
          await citizen.agent.delete(
            `/api/v1/occurrences/${occurrenceId}`
          )

        expect(
          deleteResponse.status
        ).toBe(204)

        const stored =
          await prisma.occurrence
            .findUniqueOrThrow({
              where: {
                id: occurrenceId
              }
            })

        expect(
          stored.deletedAt
        ).not.toBeNull()

        /*
         * Exclusão é lógica.
         * O registro continua no banco.
         */
        expect(
          stored.id
        ).toBe(
          occurrenceId
        )

        const detailResponse =
          await citizen.agent.get(
            `/api/v1/occurrences/${occurrenceId}`
          )

        expect(
          detailResponse.status
        ).toBe(404)

        const listResponse =
          await citizen.agent.get(
            "/api/v1/occurrences"
          )

        expect(
          listResponse.status
        ).toBe(200)

        expect(
          listResponse.body.data.some(
            (item: {
              id: string
            }) =>
              item.id ===
              occurrenceId
          )
        ).toBe(false)

        const audit =
          await prisma.auditLog.findFirst({
            where: {
              actorUserId:
                citizen.user.id,

              entityId:
                occurrenceId,

              action:
                "CITIZEN_OCCURRENCE_DELETED"
            }
          })

        expect(audit).not.toBeNull()
      }
    )

    it(
      "deve rejeitar PATCH vazio",
      async () => {
        const {
          citizen,
          occurrenceId
        } =
          await createOccurrenceForCitizen()

        const response =
          await citizen.agent
            .patch(
              `/api/v1/occurrences/${occurrenceId}`
            )
            .send({})

        expect(response.status).toBe(422)

        expect(
          response.body.error.code
        ).toBe(
          "VALIDATION_ERROR"
        )
      }
    )
  }
)
