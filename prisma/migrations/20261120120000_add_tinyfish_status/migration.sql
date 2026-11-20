CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "trade_date" DATE NOT NULL,
    "fetched_at" TIMESTAMPTZ(3),
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data_health" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingestion_runs_trade_date_source_key" ON "ingestion_runs"("trade_date", "source");
CREATE INDEX "ingestion_runs_received_at_idx" ON "ingestion_runs"("received_at");

CREATE TABLE "cost_model_review_state" (
    "id" TEXT NOT NULL,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMPTZ(3),
    "last_changed_at" TIMESTAMPTZ(3),
    "last_summary" TEXT,
    "last_monitor_id" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_model_review_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cost_model_review_events" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "is_relevant" BOOLEAN,
    "summary" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "cost_model_review_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cost_model_review_events_monitor_id_received_at_idx" ON "cost_model_review_events"("monitor_id", "received_at");
