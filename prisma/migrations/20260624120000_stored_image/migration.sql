-- Image bytes captured into the shared DB (e.g. an Instagram reel cover).
-- cdninstagram URLs are signed/short-lived and break on another machine or
-- later; we copy the bytes here once and serve them via /api/stored-image/[id]
-- so a cover set from a reel is stable across every machine. Purely additive.
CREATE TABLE "StoredImage" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/jpeg',
    "bytes" BYTEA NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'instagram',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredImage_pkey" PRIMARY KEY ("id")
);
