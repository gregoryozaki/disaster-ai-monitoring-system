export interface StoreObjectInput {
  key: string
  body: Buffer
  contentType: string
}

export interface StoredObject {
  storageRef: string
}

export interface StoredObjectContent {
  body: Buffer
  contentType?: string
}

export interface ObjectStorage {
  ensureBucket(): Promise<void>

  put(input: StoreObjectInput): Promise<StoredObject>

  get(storageRef: string): Promise<StoredObjectContent>

  delete(storageRef: string): Promise<void>
}
