import { access, cp, mkdir, rm } from "node:fs/promises"

import { dirname, join } from "node:path"

import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))

const appDirectory = join(scriptDirectory, "..")

const standaloneDirectory = join(
  appDirectory,
  ".next",
  "standalone",
  "apps",
  "mobile",
  "frontend"
)

const standaloneServer = join(standaloneDirectory, "server.js")

const sourcePublic = join(appDirectory, "public")

const targetPublic = join(standaloneDirectory, "public")

const sourceStatic = join(appDirectory, ".next", "static")

const targetStatic = join(standaloneDirectory, ".next", "static")

async function ensureExists(path, label) {
  try {
    await access(path)
  } catch {
    throw new Error(`${label} não encontrado: ${path}`)
  }
}

async function main() {
  await ensureExists(standaloneServer, "Servidor standalone")

  await ensureExists(sourcePublic, "Diretório public")

  await ensureExists(sourceStatic, "Assets estáticos do Next.js")

  await mkdir(standaloneDirectory, {
    recursive: true
  })

  await rm(targetPublic, {
    recursive: true,
    force: true
  })

  await cp(sourcePublic, targetPublic, {
    recursive: true
  })

  await mkdir(join(standaloneDirectory, ".next"), {
    recursive: true
  })

  await rm(targetStatic, {
    recursive: true,
    force: true
  })

  await cp(sourceStatic, targetStatic, {
    recursive: true
  })

  console.log("Standalone do Kamara preparado com public/ e .next/static/.")
}

await main()
