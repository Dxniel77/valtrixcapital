-- Record charged copy-trading performance fees separately from user P&L.
ALTER TYPE "CopyLedgerKind" ADD VALUE IF NOT EXISTS 'PERFORMANCE_FEE';
