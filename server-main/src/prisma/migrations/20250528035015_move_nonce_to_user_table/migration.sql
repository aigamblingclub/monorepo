/*
  Warnings:

  - You are about to drop the column `nonce` on the `Player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "nonce";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nonce" INTEGER NOT NULL DEFAULT 0;
