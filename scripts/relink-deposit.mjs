/**
 * Safe one-off: relink a PENDING deposit that recorded the WRONG transaction
 * hash (e.g. a failed retry) to the real, successful on-chain transfer.
 *
 * It verifies the successful transaction on-chain (correct sender, treasury,
 * token, amount, and success status) BEFORE touching the DB, then only repoints
 * the deposit's txHash. Confirmation itself is left to the hardened server path
 * (the process-deposits cron / portfolio reconcile), which re-verifies on-chain
 * and creates the stake, credits locked capital, and refreshes the payout cap
 * atomically.
 *
 * Usage (dry run):
 *   node scripts/run-with-env.mjs node scripts/relink-deposit.mjs
 *   node scripts/run-with-env.mjs node scripts/relink-deposit.mjs <failedHash> <successHash>
 * Apply:
 *   node scripts/run-with-env.mjs node scripts/relink-deposit.mjs <failedHash> <successHash> --commit
 */
import { PrismaClient } from "@prisma/client";
import { createPublicClient, http, decodeEventLog, formatUnits } from "viem";
import { bsc, polygon } from "viem/chains";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const COMMIT = process.argv.includes("--commit");

// Defaults target the reported incident; override via CLI args.
const FAILED_HASH = (
  args[0] ?? "0x07ed0649fb973ca3e777ed8a5540208c4c14c440d7b46a7f453ac30b99c929cd"
).toLowerCase();
const SUCCESS_HASH = (
  args[1] ?? "0xd725f92efb48cc7eddc1671325fe6d76882bafea009a5e95311ab326b61de6e7"
).toLowerCase();

const USDT = {
  BSC: "0x55d398326f99059ff775485246999027b3197955",
  POLYGON: "0xc2132d05d31c914a87c6611c10748aefb8b1e0ff",
};
const DECIMALS = { BSC: 18, POLYGON: 6 };
const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" },
  ],
};

function rpcUrl(network) {
  if (network === "BSC") {
    return process.env.NEXT_PUBLIC_BSC_RPC?.trim() || "https://bsc-dataseed.binance.org";
  }
  return (
    process.env.NEXT_PUBLIC_POLYGON_RPC?.trim() ||
    "https://polygon-bor-rpc.publicnode.com"
  );
}

function publicClient(network) {
  return createPublicClient({
    chain: network === "BSC" ? bsc : polygon,
    transport: http(rpcUrl(network)),
  });
}

async function verifyTransfer(network, txHash, expectedFrom, expectedTo) {
  const receipt = await publicClient(network).getTransactionReceipt({ hash: txHash });
  if (!receipt || receipt.status !== "success") return null;
  const usdt = USDT[network];
  const decimals = DECIMALS[network];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdt) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const from = String(decoded.args.from).toLowerCase();
      const to = String(decoded.args.to).toLowerCase();
      if (from !== expectedFrom.toLowerCase() || to !== expectedTo.toLowerCase()) continue;
      return { amount: Number(formatUnits(decoded.args.value, decimals)), from, to };
    } catch {
      /* not a transfer log */
    }
  }
  return null;
}

const prisma = new PrismaClient();

try {
  const deposit = await prisma.deposit.findUnique({
    where: { txHash: FAILED_HASH },
    include: { stake: true },
  });
  if (!deposit) {
    console.error(`No deposit found with hash ${FAILED_HASH}`);
    process.exit(1);
  }

  console.log(
    `Deposit ${deposit.id} · ${deposit.network} · ${Number(deposit.amount) / 1e6} USDT · status ${deposit.status}`,
  );
  console.log(`  from ${deposit.fromAddress}`);
  console.log(`  to   ${deposit.toAddress}`);

  if (deposit.status === "CONFIRMED") {
    console.log("Already CONFIRMED — nothing to do.");
    process.exit(0);
  }

  const clash = await prisma.deposit.findUnique({ where: { txHash: SUCCESS_HASH } });
  if (clash && clash.id !== deposit.id) {
    console.error(`Success hash already linked to another deposit (${clash.id}). Aborting.`);
    process.exit(1);
  }

  console.log(`Verifying successful tx ${SUCCESS_HASH} on ${deposit.network}...`);
  const verified = await verifyTransfer(
    deposit.network,
    SUCCESS_HASH,
    deposit.fromAddress,
    deposit.toAddress,
  );
  if (!verified) {
    console.error("On-chain verification FAILED (not success, or from/to/token mismatch). Aborting.");
    process.exit(1);
  }

  const expectedUsdt = Number(deposit.amount) / 1e6;
  console.log(`Verified: ${verified.amount} USDT ${verified.from} -> ${verified.to}`);
  if (Math.abs(verified.amount - expectedUsdt) > 1e-6) {
    console.error(`Amount mismatch: on-chain ${verified.amount} vs deposit ${expectedUsdt}. Aborting.`);
    process.exit(1);
  }

  if (!COMMIT) {
    console.log("\nDRY RUN — no changes written.");
    console.log(`Re-run with --commit to repoint txHash ${FAILED_HASH} -> ${SUCCESS_HASH}.`);
    console.log("After that, run the process-deposits cron (or wait ~5 min); it will confirm and activate the stake.");
    process.exit(0);
  }

  await prisma.deposit.update({
    where: { id: deposit.id },
    data: { txHash: SUCCESS_HASH, confirmations: 0 },
  });

  console.log("\nRepointed txHash successfully. Deposit is still PENDING with the correct hash.");
  console.log("Now trigger confirmation via the hardened server path, e.g.:");
  console.log("  curl -X POST https://capitalvaltrix.com/api/cron/process-deposits");
  console.log("(or wait for the scheduled cron). It will verify on-chain and activate the 590 USDT stake.");
} finally {
  await prisma.$disconnect();
}
