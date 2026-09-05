import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { prisma } from "../../src/prisma/client.js"

import { createAuthenticatedAdmin } from "../helpers/auth.js"

function uniqueTestCobradeCode() {
  return `TEST-${randomUUID().slice(0, 8)}`
}

describe("Configuração administrativa persistente", () => {
  it("deve listar categorias reais do PostgreSQL no endpoint administrativo", async () => {
    const admin = await createAuthenticatedAdmin()

    const code = uniqueTestCobradeCode()

    const category = await prisma.disasterCategory.create({
      data: {
        cobradeCode: code,
        name: "Categoria Administrativa Teste",
        groupName: "TESTES",
        active: false
      }
    })

    const response = await admin.agent.get("/api/v1/admin/categories")

    expect(response.status).toBe(200)

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: category.id,
          cobradeCode: code,
          active: false
        })
      ])
    )
  })

  it("deve criar categoria fora do escopo como inativa e registrar auditoria", async () => {
    const admin = await createAuthenticatedAdmin()

    const cobradeCode = uniqueTestCobradeCode()

    const response = await admin.agent.post("/api/v1/admin/categories").send({
      cobradeCode,
      name: "Categoria Fora do Escopo",
      groupName: "TESTES"
    })

    expect(response.status).toBe(201)

    expect(response.body.data).toMatchObject({
      cobradeCode,
      active: false
    })

    const stored = await prisma.disasterCategory.findUniqueOrThrow({
      where: {
        cobradeCode
      }
    })

    expect(stored.active).toBe(false)

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "CATEGORY_CREATED",
        entityId: stored.id
      }
    })

    expect(audit).not.toBeNull()
  })

  it("não deve permitir ativar categoria fora das sete categorias operacionais", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.create({
      data: {
        cobradeCode: uniqueTestCobradeCode(),
        name: "Categoria Não Operacional",
        groupName: "TESTES",
        active: false
      }
    })

    const response = await admin.agent
      .patch(`/api/v1/admin/categories/${category.id}`)
      .send({
        active: true
      })

    expect(response.status).toBe(422)

    expect(response.body.error.code).toBe("CATEGORY_OUTSIDE_OPERATIONAL_SCOPE")

    const stored = await prisma.disasterCategory.findUniqueOrThrow({
      where: {
        id: category.id
      }
    })

    expect(stored.active).toBe(false)
  })

  it("não deve retornar categoria inativa na rota operacional pública", async () => {
    const admin = await createAuthenticatedAdmin()

    const cobradeCode = uniqueTestCobradeCode()

    await prisma.disasterCategory.create({
      data: {
        cobradeCode,
        name: "Categoria Pública Inativa",
        groupName: "TESTES",
        active: false
      }
    })

    const response = await admin.agent.get("/api/v1/disaster-categories")

    expect(response.status).toBe(200)

    expect(
      response.body.data.some(
        (category: { cobradeCode: string }) =>
          category.cobradeCode === cobradeCode
      )
    ).toBe(false)
  })

  it("deve versionar limiares e manter somente a versão mais recente ativa", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.upsert({
      where: {
        cobradeCode: "1.2.3.0.0"
      },

      update: {
        name: "Alagamentos",
        groupName: "NATURAIS - Hidrológico",
        active: true
      },

      create: {
        cobradeCode: "1.2.3.0.0",
        name: "Alagamentos",
        groupName: "NATURAIS - Hidrológico",
        active: true
      }
    })

    await prisma.confidenceThreshold.deleteMany({
      where: {
        categoryId: category.id,
        modelType: "TEXTUAL"
      }
    })

    const first = await admin.agent
      .post("/api/v1/admin/confidence-thresholds")
      .send({
        categoryId: category.id,
        modelType: "TEXTUAL",
        lowUpperBound: 0.4,
        mediumUpperBound: 0.7
      })

    expect(first.status).toBe(201)

    expect(first.body.data).toMatchObject({
      version: 1,
      active: true
    })

    const second = await admin.agent
      .post("/api/v1/admin/confidence-thresholds")
      .send({
        categoryId: category.id,
        modelType: "TEXTUAL",
        lowUpperBound: 0.45,
        mediumUpperBound: 0.75
      })

    expect(second.status).toBe(201)

    expect(second.body.data).toMatchObject({
      version: 2,
      active: true
    })

    const thresholds = await prisma.confidenceThreshold.findMany({
      where: {
        categoryId: category.id,
        modelType: "TEXTUAL"
      },

      orderBy: {
        version: "asc"
      }
    })

    expect(thresholds).toHaveLength(2)

    expect(thresholds[0].active).toBe(false)

    expect(thresholds[1].active).toBe(true)
  })

  it("deve rejeitar faixas de confiança inválidas", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.upsert({
      where: {
        cobradeCode: "1.2.2.0.0"
      },

      update: {
        name: "Enxurradas",
        groupName: "NATURAIS - Hidrológico",
        active: true
      },

      create: {
        cobradeCode: "1.2.2.0.0",
        name: "Enxurradas",
        groupName: "NATURAIS - Hidrológico",
        active: true
      }
    })

    const response = await admin.agent
      .post("/api/v1/admin/confidence-thresholds")
      .send({
        categoryId: category.id,
        modelType: "TEXTUAL",
        lowUpperBound: 0.8,
        mediumUpperBound: 0.6
      })

    expect(response.status).toBe(400)

    expect(response.body.error.code).toBe("INVALID_THRESHOLDS")
  })

  it("não deve criar limiar para categoria inativa", async () => {
    const admin = await createAuthenticatedAdmin()

    const category = await prisma.disasterCategory.create({
      data: {
        cobradeCode: uniqueTestCobradeCode(),
        name: "Categoria Inativa Threshold",
        groupName: "TESTES",
        active: false
      }
    })

    const response = await admin.agent
      .post("/api/v1/admin/confidence-thresholds")
      .send({
        categoryId: category.id,
        modelType: "VISUAL",
        lowUpperBound: 0.4,
        mediumUpperBound: 0.7
      })

    expect(response.status).toBe(422)

    expect(response.body.error.code).toBe("INVALID_DISASTER_CATEGORY")
  })

  it("deve consultar auditoria real persistida no PostgreSQL", async () => {
    const admin = await createAuthenticatedAdmin()

    const audit = await prisma.auditLog.create({
      data: {
        actorUserId: admin.user.id,
        action: "ADMIN_AUDIT_TEST",
        entityType: "TEST",
        entityId: randomUUID(),
        metadata: {
          source: "integration-test"
        }
      }
    })

    const response = await admin.agent.get("/api/v1/admin/audit")

    expect(response.status).toBe(200)

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: audit.id,
          action: "ADMIN_AUDIT_TEST",

          actorUser: expect.objectContaining({
            id: admin.user.id,
            role: "ADMIN"
          })
        })
      ])
    )
  })
})
