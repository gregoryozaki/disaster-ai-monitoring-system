import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3"

import { env } from "../../src/config/env.js"

const client = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,

  region: env.STORAGE_REGION,

  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,

    secretAccessKey: env.STORAGE_SECRET_KEY
  },

  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE
})

export async function resetStorage() {
  if (!env.STORAGE_BUCKET.includes("test")) {
    throw new Error("Recusando limpar bucket que não seja de teste.")
  }

  let continuationToken: string | undefined

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: env.STORAGE_BUCKET,

        ContinuationToken: continuationToken
      })
    )

    const keys = (result.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => typeof key === "string")

    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: env.STORAGE_BUCKET,

          Delete: {
            Objects: keys.map((key) => ({
              Key: key
            }))
          }
        })
      )
    }

    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined
  } while (continuationToken)
}
