-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nearImplicitAddress" TEXT NOT NULL,
    "nearNamedAddress" TEXT NOT NULL,
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
