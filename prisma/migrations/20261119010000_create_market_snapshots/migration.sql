CREATE TABLE "market_snapshots" (
    "id" TEXT NOT NULL,
    "bucket_at" TIMESTAMPTZ(3) NOT NULL,
    "as_of" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_snapshots_bucket_at_key" ON "market_snapshots"("bucket_at");
CREATE INDEX "market_snapshots_as_of_idx" ON "market_snapshots"("as_of");
