/*
  Warnings:

  - You are about to drop the column `pendingUnlockTxHash` on the `UserBalance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserBalance" DROP COLUMN "pendingUnlockTxHash",
ADD COLUMN     "pendingUnlockDeadline" TIMESTAMP(3);
