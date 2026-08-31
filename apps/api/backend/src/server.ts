import { app } from "./app.js"
import { env } from "./config/env.js"
import { objectStorage } from "./integrations/storage/s3-storage.js"

async function bootstrap() {
  try {
    await objectStorage.ensureBucket()

    app.listen(env.PORT, () => {
      console.log(`Kamara API listening on port ${env.PORT}`)
    })
  } catch (error) {
    console.error("Falha ao inicializar a Kamara API:", error)

    process.exit(1)
  }
}

void bootstrap()
