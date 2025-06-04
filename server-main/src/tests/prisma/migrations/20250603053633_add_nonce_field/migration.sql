-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nearImplicitAddress" TEXT NOT NULL,
    "nearNamedAddress" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyValue" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBalance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "onchainBalance" INTEGER NOT NULL,
    "virtualBalance" INTEGER NOT NULL,
    "pendingUnlock" BOOLEAN NOT NULL DEFAULT false,
    "pendingUnlockDeadline" DATETIME,
    "userCanBet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" TEXT NOT NULL,
    "tableStatus" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "winners" TEXT NOT NULL,
    "totalBets" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,
    "winners" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Round_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("tableId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" TEXT NOT NULL,
    "roundId" INTEGER NOT NULL,
    "phaseName" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Phase_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("tableId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Phase_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecisionContext" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "thinking" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "logic" TEXT NOT NULL,
    "roleplay" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Moves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "phaseId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerTurn" INTEGER NOT NULL,
    "move" TEXT NOT NULL,
    "decisionContextId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Moves_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Moves_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Moves_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Moves_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("playerId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Moves_decisionContextId_fkey" FOREIGN KEY ("decisionContextId") REFERENCES "DecisionContext" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerHand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "firstCardRank" INTEGER NOT NULL,
    "firstCardSuit" TEXT NOT NULL,
    "secondCardRank" INTEGER NOT NULL,
    "secondCardSuit" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerHand_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerHand_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerHand_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("playerId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "tableId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundId" INTEGER,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBet_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("tableId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("playerId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Player_Table" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "initialBalance" INTEGER NOT NULL,
    "currentBalance" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_Table_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("playerId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Player_Table_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("tableId") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "UserBalance_userId_key" ON "UserBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_tableId_key" ON "Table"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerId_key" ON "Player"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_Table_playerId_tableId_key" ON "Player_Table"("playerId", "tableId");
