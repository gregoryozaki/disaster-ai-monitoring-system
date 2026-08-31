import type { ErrorRequestHandler } from "express"
import { ZodError } from "zod"
import { HttpError } from "../lib/http-error.js"

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados invalidos.",
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      }
    })
  }

  if (error instanceof HttpError) {
    return res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } })
  }

  console.error(error)
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno inesperado." }
  })
}
