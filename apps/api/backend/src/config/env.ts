import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3333),
    // Quantos proxies reversos confiáveis existem na frente da API.
  // 0 = nenhum (API exposta direto): o X-Forwarded-For do cliente é ignorado.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET deve possuir pelo menos 32 caracteres"),

  STORAGE_ENDPOINT: z.string().url(),

  STORAGE_REGION: z.string().min(1),

  STORAGE_BUCKET: z.string().min(1),

  STORAGE_ACCESS_KEY: z.string().min(1),

  STORAGE_SECRET_KEY: z.string().min(1),

  STORAGE_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),

  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),

  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  AI_PREANALYSIS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  EXPOSE_DEV_RESET_TOKEN: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:")

  console.error(parsed.error.flatten().fieldErrors)

  throw new Error("Configuração de ambiente inválida.")
}

export const env = parsed.data
