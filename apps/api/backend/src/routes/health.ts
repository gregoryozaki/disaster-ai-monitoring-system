import { Router } from "express"

import { prisma } from "../prisma/client.js"

export const healthRouter = Router()

healthRouter.get("/", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})
