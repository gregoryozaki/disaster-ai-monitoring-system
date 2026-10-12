import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import rateLimit from "express-rate-limit"
import helmet from "helmet"

import { env } from "./config/env.js"

import { errorHandler } from "./middlewares/error-handler.js"

import { adminRouter } from "./routes/admin.js"

import { analyticsRouter } from "./routes/analytics.js"

import { authRouter } from "./routes/auth.js"

import { disasterCategoriesRouter } from "./routes/disaster-categories.js"

import { exportsRouter } from "./routes/exports.js"

import { healthRouter } from "./routes/health.js"

import { managerRouter } from "./routes/manager.js"

import { mediaRouter } from "./routes/media.js"

import { occurrencesRouter } from "./routes/occurrences.js"

import { predictionsRouter } from "./routes/predictions.js"

import { publicRouter } from "./routes/public.js"

const allowedOrigins = [
  /^http:\/\/localhost:3001$/,
  /^http:\/\/localhost:3002$/,
  /^http:\/\/127\.0\.0\.1:3001$/,
  /^http:\/\/127\.0\.0\.1:3002$/
]

export const app = express()

app.set("trust proxy", env.TRUST_PROXY)

app.use(helmet())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
        return callback(null, true)
      }

      return callback(new Error("Origem não permitida pelo CORS."))
    },

    credentials: true
  })
)

app.use(
  express.json({
    limit: "1mb"
  })
)

app.use(cookieParser())

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
)

app.use("/health", healthRouter)

app.use("/api/v1/auth", authRouter)

app.use("/api/v1/occurrences", occurrencesRouter)

app.use("/api/v1/public", publicRouter)

app.use("/api/v1/manager", managerRouter)

app.use("/api/v1/disaster-categories", disasterCategoriesRouter)

app.use("/api/v1/media", mediaRouter)

app.use("/api/v1/analytics", analyticsRouter)

app.use("/api/v1/predictions", predictionsRouter)

app.use("/api/v1/exports", exportsRouter)

app.use("/api/v1/admin", adminRouter)

// Middleware de erro sempre por último.
app.use(errorHandler)
