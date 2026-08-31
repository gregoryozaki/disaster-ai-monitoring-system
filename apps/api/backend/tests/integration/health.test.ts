import request from "supertest"

import { describe, expect, it } from "vitest"

import { app } from "../../src/app.js"

describe("GET /health", () => {
  it("deve informar que API e banco estão disponíveis", async () => {
    const response = await request(app).get("/health")

    expect(response.status).toBe(200)

    expect(response.body).toMatchObject({
      status: "ok",
      database: "ok"
    })

    expect(response.body.timestamp).toEqual(expect.any(String))
  })
})
