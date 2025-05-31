/*
  Warnings:

  - You are about to drop the column `nonce` on the `Player` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[playerId,tableId]` on the table `Player_Table` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `UserBalance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'DRAW');

-- DropForeignKey
ALTER TABLE "UserBet" DROP CONSTRAINT "UserBet_roundId_fkey";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "nonce";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nonce" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserBet" ADD COLUMN     "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "roundId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Player_Table_playerId_tableId_key" ON "Player_Table"("playerId", "tableId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBalance_userId_key" ON "UserBalance"("userId");

-- AddForeignKey
ALTER TABLE "UserBet" ADD CONSTRAINT "UserBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;
