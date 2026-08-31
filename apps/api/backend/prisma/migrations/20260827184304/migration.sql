/*
  Warnings:

  - A unique constraint covering the columns `[requestId]` on the table `occurrence_complements` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "occurrence_complements_requestId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "occurrence_complements_requestId_key" ON "occurrence_complements"("requestId");
