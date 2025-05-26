-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nearImplicitAddress" TEXT NOT NULL,
    "nearNamedAddress" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" SERIAL NOT NULL,
    "keyValue" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "totalUses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBalance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "onchainBalance" INTEGER NOT NULL,
    "virtualBalance" INTEGER NOT NULL,
    "pendingUnlock" BOOLEAN NOT NULL DEFAULT false,
    "pendingUnlockTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" SERIAL NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableStatus" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player_Table" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "initialBalance" INTEGER NOT NULL,
    "currentBalance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" SERIAL NOT NULL,
    "tableId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,
    "winners" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" SERIAL NOT NULL,
    "tableId" TEXT NOT NULL,
    "roundId" INTEGER NOT NULL,
    "phaseName" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionContext" (
    "id" SERIAL NOT NULL,
    "thinking" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "logic" TEXT NOT NULL,
    "roleplay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moves" (
    "id" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "phaseId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerTurn" INTEGER NOT NULL,
    "move" TEXT NOT NULL,
    "decisionContextId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerHand" (
    "id" SERIAL NOT NULL,
    "tableId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "firstCardRank" INTEGER NOT NULL,
    "firstCardSuit" TEXT NOT NULL,
    "secondCardRank" INTEGER NOT NULL,
    "secondCardSuit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerHand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tableId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawState" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nearImplicitAddress_key" ON "User"("nearImplicitAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_nearNamedAddress_key" ON "User"("nearNamedAddress");

-- CreateIndex
CREATE INDEX "idx_near_account" ON "User"("nearImplicitAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyValue_key" ON "ApiKey"("keyValue");

-- CreateIndex
CREATE INDEX "idx_api_key_value" ON "ApiKey"("keyValue");

-- CreateIndex
CREATE UNIQUE INDEX "Table_tableId_key" ON "Table"("tableId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBalance" ADD CONSTRAINT "UserBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player_Table" ADD CONSTRAINT "Player_Table_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player_Table" ADD CONSTRAINT "Player_Table_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("tableId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("tableId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("tableId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moves" ADD CONSTRAINT "Moves_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moves" ADD CONSTRAINT "Moves_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moves" ADD CONSTRAINT "Moves_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moves" ADD CONSTRAINT "Moves_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moves" ADD CONSTRAINT "Moves_decisionContextId_fkey" FOREIGN KEY ("decisionContextId") REFERENCES "DecisionContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerHand" ADD CONSTRAINT "PlayerHand_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerHand" ADD CONSTRAINT "PlayerHand_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerHand" ADD CONSTRAINT "PlayerHand_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBet" ADD CONSTRAINT "UserBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBet" ADD CONSTRAINT "UserBet_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("tableId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBet" ADD CONSTRAINT "UserBet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBet" ADD CONSTRAINT "UserBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
