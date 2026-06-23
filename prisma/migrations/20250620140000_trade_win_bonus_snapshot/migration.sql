-- Per-win bonus at capital snapshot (not recalculated at current capital).
ALTER TABLE "Trade" ADD COLUMN "capitalSnapshotAtWin" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Trade" ADD COLUMN "bonusCredited" BIGINT NOT NULL DEFAULT 0;
