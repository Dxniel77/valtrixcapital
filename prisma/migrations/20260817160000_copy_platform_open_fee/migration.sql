-- Platform open fee (0.05% of notional) and per-operation fee totals
-- for the HTML-style copy company board.

ALTER TYPE "CopyLedgerKind" ADD VALUE IF NOT EXISTS 'PLATFORM_FEE';

ALTER TABLE "CopyTradingConfig"
ADD COLUMN "openFeeBps" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "CopyTraderOperation"
ADD COLUMN "platformFeeMicro" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "performanceFeeMicro" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "grossPnlMicro" BIGINT NOT NULL DEFAULT 0;
