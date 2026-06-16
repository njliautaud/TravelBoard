-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "mapTheme" TEXT NOT NULL DEFAULT 'CLASSIC',
    "homeAirports" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TO_VISIT',
    "notes" TEXT,
    "reminderAt" DATETIME,
    "priceThreshold" DECIMAL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "seasonSpring" BOOLEAN NOT NULL DEFAULT false,
    "seasonSummer" BOOLEAN NOT NULL DEFAULT false,
    "seasonFall" BOOLEAN NOT NULL DEFAULT false,
    "seasonWinter" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Media_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FlightPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locationId" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "origin" TEXT,
    "destination" TEXT,
    "source" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightPrice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rawText" TEXT,
    "extractedUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FareCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "flyToCode" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "outboundDate" DATETIME,
    "returnDate" DATETIME,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "airline" TEXT,
    "source" TEXT,
    "dealScore" REAL,
    "tier" TEXT,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FareHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "source" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destinationCode" TEXT NOT NULL,
    "targetPrice" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" DATETIME,
    "lastAlertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchId" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "source" TEXT,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertLog_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "note" TEXT,
    "rating" INTEGER,
    "coverImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "budget" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TripPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripPlanLeg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripPlanId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departDate" DATETIME,
    "returnDate" DATETIME,
    "fareAmount" DECIMAL,
    "fareSource" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TripPlanLeg_tripPlanId_fkey" FOREIGN KEY ("tripPlanId") REFERENCES "TripPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "location" TEXT,
    "country" TEXT,
    "lat" REAL,
    "lon" REAL,
    "date" DATETIME,
    "mood" TEXT,
    "weather" TEXT,
    "tags" TEXT,
    "photos" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntry_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "issuer" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "annualFee" DECIMAL,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoyaltyBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "programCode" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT,
    "expiresAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoyaltyBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialBoard_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoardDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardDeal_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "SocialBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardDeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoardComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoardComment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "BoardDeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoardComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GamificationProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "badges" TEXT,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" DATETIME,
    CONSTRAINT "GamificationProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPref" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dealAlerts" BOOLEAN NOT NULL DEFAULT true,
    "priceDrops" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReport" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NotificationPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Location_countryCode_idx" ON "Location"("countryCode");

-- CreateIndex
CREATE INDEX "Location_userId_idx" ON "Location"("userId");

-- CreateIndex
CREATE INDEX "FlightPrice_locationId_fetchedAt_idx" ON "FlightPrice"("locationId", "fetchedAt");

-- CreateIndex
CREATE INDEX "Draft_userId_createdAt_idx" ON "Draft"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FareCache_origin_destination_idx" ON "FareCache"("origin", "destination");

-- CreateIndex
CREATE INDEX "FareCache_origin_month_idx" ON "FareCache"("origin", "month");

-- CreateIndex
CREATE INDEX "FareCache_flyToCode_idx" ON "FareCache"("flyToCode");

-- CreateIndex
CREATE INDEX "FareHistory_origin_destination_idx" ON "FareHistory"("origin", "destination");

-- CreateIndex
CREATE INDEX "FareHistory_recordedAt_idx" ON "FareHistory"("recordedAt");

-- CreateIndex
CREATE INDEX "Watch_userId_idx" ON "Watch"("userId");

-- CreateIndex
CREATE INDEX "Watch_origin_destinationCode_idx" ON "Watch"("origin", "destinationCode");

-- CreateIndex
CREATE INDEX "AlertLog_watchId_idx" ON "AlertLog"("watchId");

-- CreateIndex
CREATE INDEX "AlertLog_triggeredAt_idx" ON "AlertLog"("triggeredAt");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "Trip_code_idx" ON "Trip"("code");

-- CreateIndex
CREATE INDEX "TripPlan_userId_idx" ON "TripPlan"("userId");

-- CreateIndex
CREATE INDEX "TripPlan_status_idx" ON "TripPlan"("status");

-- CreateIndex
CREATE INDEX "TripPlanLeg_tripPlanId_idx" ON "TripPlanLeg"("tripPlanId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_tripId_idx" ON "JournalEntry"("tripId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "CardProfile_userId_idx" ON "CardProfile"("userId");

-- CreateIndex
CREATE INDEX "LoyaltyBalance_userId_idx" ON "LoyaltyBalance"("userId");

-- CreateIndex
CREATE INDEX "SocialBoard_creatorId_idx" ON "SocialBoard"("creatorId");

-- CreateIndex
CREATE INDEX "BoardDeal_boardId_idx" ON "BoardDeal"("boardId");

-- CreateIndex
CREATE INDEX "BoardDeal_userId_idx" ON "BoardDeal"("userId");

-- CreateIndex
CREATE INDEX "BoardComment_dealId_idx" ON "BoardComment"("dealId");

-- CreateIndex
CREATE INDEX "BoardComment_userId_idx" ON "BoardComment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamificationProgress_userId_key" ON "GamificationProgress"("userId");

-- CreateIndex
CREATE INDEX "GamificationProgress_userId_idx" ON "GamificationProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPref_userId_key" ON "NotificationPref"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
