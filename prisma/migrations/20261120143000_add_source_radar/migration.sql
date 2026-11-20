CREATE TABLE "source_log" (
    "id" TEXT NOT NULL,
    "ts_ist" TIMESTAMPTZ(3) NOT NULL,
    "source_name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "rows_returned" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "source_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "source_log_sourceName_tsIst_idx"
ON "source_log"("source_name", "ts_ist");

CREATE TABLE "cross_check" (
    "id" TEXT NOT NULL,
    "trade_date" DATE NOT NULL,
    "symbol" TEXT NOT NOT NULL,
    "expiry" DATE NOT NULL,
    "settle_a" DOUBLE PRECISION NOT NULL,
    "settle_b" DOUBLE PRECISION,
    "diff_bps" DOUBLE PRECISION,
    "state" TEXT NOT NULL,
    "source_b_url" TEXT,
    "checked_at_ist" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "cross_check_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cross_check_trade_date_symbol_expiry_key"
ON "cross_check"("trade_date", "symbol", "expiry");

CREATE INDEX "cross_check_trade_date_checkedAtIst_idx"
ON "cross_check"("trade_date", "checked_at_ist");
