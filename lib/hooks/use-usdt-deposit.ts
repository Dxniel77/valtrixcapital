"use client";

import * as React from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { bsc, polygon } from "wagmi/chains";
import type { Hash } from "viem";
import type { StakingNetwork } from "@/lib/staking/store";
import { buildUsdtTransferCall } from "@/lib/wallet/usdt-transfer";

function targetChainId(network: StakingNetwork): number {
  return network === "POLYGON" ? polygon.id : bsc.id;
}

export function useUsdtDeposit() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  const deposit = React.useCallback(
    async (input: {
      network: StakingNetwork;
      amount: number;
      toAddress: `0x${string}`;
    }): Promise<Hash> => {
      if (!address) {
        throw new Error("WALLET_NOT_CONNECTED");
      }

      const requiredChainId = targetChainId(input.network);
      if (chainId !== requiredChainId) {
        await switchChainAsync({ chainId: requiredChainId });
      }

      const call = buildUsdtTransferCall(
        input.network,
        input.toAddress,
        input.amount,
      );

      return writeContractAsync(call);
    },
    [address, chainId, switchChainAsync, writeContractAsync],
  );

  return { deposit, isPending, address };
}
