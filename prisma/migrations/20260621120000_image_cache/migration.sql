-- CreateTable
CREATE TABLE "ImageCache" (
    "id" TEXT NOT NULL,
    "searchQuery" TEXT NOT NULL,
    "images" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'serper',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageCache_searchQuery_key" ON "ImageCache"("searchQuery");
