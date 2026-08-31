import type { NextFunction, Request, Response } from "express"

import type { ZodSchema } from "zod"

import { HttpError } from "../lib/http-error.js"

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body)

    next()
  }
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.params)

    if (!parsed.success) {
      return next(
        new HttpError(
          400,
          "Parâmetros de rota inválidos.",
          "INVALID_ROUTE_PARAMS"
        )
      )
    }

    req.params = parsed.data as Request["params"]

    next()
  }
}
