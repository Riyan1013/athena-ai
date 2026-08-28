-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('USER_PROFILE', 'EXPLICIT', 'CONVERSATION_SUMMARY');

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "conversation_id" TEXT,
    "source_message_count" INTEGER,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_memories_owner_id" ON "memories"("owner_id");

-- CreateIndex
CREATE INDEX "idx_memories_owner_conversation" ON "memories"("owner_id", "conversation_id");
