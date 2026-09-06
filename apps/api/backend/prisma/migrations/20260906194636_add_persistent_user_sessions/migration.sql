-- CreateEnum
CREATE TYPE "SessionClient" AS ENUM ('CITIZEN_PWA', 'DASHBOARD');

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "client" "SessionClient" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sessions_userId_client_revokedAt_idx" ON "user_sessions"("userId", "client", "revokedAt");

-- CreateIndex
CREATE INDEX "user_sessions_idleExpiresAt_idx" ON "user_sessions"("idleExpiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_absoluteExpiresAt_idx" ON "user_sessions"("absoluteExpiresAt");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
