import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"

import { env } from "../../config/env.js"

import type {
  ObjectStorage,
  StoredObject,
  StoredObjectContent,
  StoreObjectInput
} from "./storage.js"

const client = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,

  region: env.STORAGE_REGION,

  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY
  },

  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE
})

export class S3ObjectStorage implements ObjectStorage {
  async ensureBucket(): Promise<void> {
    try {
      await client.send(
        new HeadBucketCommand({
          Bucket: env.STORAGE_BUCKET
        })
      )
    } catch {
      await client.send(
        new CreateBucketCommand({
          Bucket: env.STORAGE_BUCKET
        })
      )
    }
  }

  async put(input: StoreObjectInput): Promise<StoredObject> {
    await client.send(
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType
      })
    )

    return {
      storageRef: input.key
    }
  }

  async get(storageRef: string): Promise<StoredObjectContent> {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: storageRef
      })
    )

    if (!response.Body) {
      throw new Error("Objeto armazenado não possui conteúdo.")
    }

    const bytes = await response.Body.transformToByteArray()

    return {
      body: Buffer.from(bytes),
      contentType: response.ContentType
    }
  }

  async delete(storageRef: string): Promise<void> {
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: storageRef
      })
    )
  }
}

export const objectStorage = new S3ObjectStorage()
