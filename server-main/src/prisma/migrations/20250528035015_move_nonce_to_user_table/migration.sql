-- Add nonce column to User table
ALTER TABLE "User" ADD COLUMN "nonce" INTEGER NOT NULL DEFAULT 0;
-- Remove nonce column from Player table
ALTER TABLE "Player" DROP COLUMN "nonce"; 
