-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "clerkId" TEXT,
    "imageUrl" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "mapTheme" TEXT NOT NULL DEFAULT 'CLASSIC',
    "homeAirports" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "homeAirports", "id", "mapTheme", "passwordHash", "role", "username") SELECT "createdAt", "homeAirports", "id", "mapTheme", "passwordHash", "role", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
