/*
  Warnings:

  - The primary key for the `Player` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Player` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `nonce` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[playerId]` on the table `Player` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nonce` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalBets` to the `Table` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Moves" DROP CONSTRAINT "Moves_playerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerHand" DROP CONSTRAINT "PlayerHand_playerId_fkey";

-- DropForeignKey
ALTER TABLE "Player_Table" DROP CONSTRAINT "Player_Table_playerId_fkey";

-- DropForeignKey
ALTER TABLE "UserBet" DROP CONSTRAINT "UserBet_playerId_fkey";

-- AlterTable
ALTER TABLE "Player" DROP CONSTRAINT "Player_pkey",
ADD COLUMN     "nonce" INTEGER NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Player_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "totalBets" INTEGER NOT NULL,
ADD COLUMN     "winners" TEXT[];

-- AlterTable
ALTER TABLE "User" DROP COLUMN "nonce";

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerId_key" ON "Player"("playerId");

-- AddForeignKey
ALTER TABLE "Player_Table" ADD CONSTRAINT "Player_Table_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("playerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moves" ADD CONSTRAINT "Moves_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("playerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerHand" ADD CONSTRAINT "PlayerHand_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("playerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBet" ADD CONSTRAINT "UserBet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("playerId") ON DELETE RESTRICT ON UPDATE CASCADE;
