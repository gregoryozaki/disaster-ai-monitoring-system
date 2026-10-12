import "fake-indexeddb/auto"

import { IDBFactory } from "fake-indexeddb"

import { beforeEach } from "vitest"

/*
 * Cada teste começa com um IndexedDB vazio.
 */
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})
