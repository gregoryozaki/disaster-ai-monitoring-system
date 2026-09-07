-- CreateTable
CREATE TABLE "user_agreements" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "responsibleUseVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_agreements_userId_acceptedAt_idx" ON "user_agreements"("userId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_agreements_userId_termsVersion_privacyVersion_responsi_key" ON "user_agreements"("userId", "termsVersion", "privacyVersion", "responsibleUseVersion");

-- AddForeignKey
ALTER TABLE "user_agreements" ADD CONSTRAINT "user_agreements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
