"use client";

import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { CHAIN_META } from "@/lib/wagmi";
import { shortenAddress } from "@/lib/utils";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chain = chainId ? CHAIN_META[chainId] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        subtitle="Your wallet, account status and security settings."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label="Status">
              {isConnected ? (
                <Badge variant="success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="warning">Disconnected</Badge>
              )}
            </Row>
            <Separator />
            <Row label="Address">
              {address ? (
                <span className="font-mono text-text-primary">
                  {shortenAddress(address, 10, 8)}
                </span>
              ) : (
                <span className="text-text-muted">Not connected</span>
              )}
            </Row>
            <Separator />
            <Row label="Network">
              {chain ? (
                <Badge variant="gold">{chain.name}</Badge>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Row>
            <Separator />
            <Row label="Account">
              <ConnectWalletButton variant="outline" size="sm" />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label="Role">
              <Badge>User</Badge>
            </Row>
            <Separator />
            <Row label="Member since">
              <span className="font-mono text-text-primary">May 2026</span>
            </Row>
            <Separator />
            <Row label="2FA">
              <Badge variant="warning">Coming Week 6</Badge>
            </Row>
            <Separator />
            <Row label="Email">
              <span className="text-text-muted">Optional · Week 6</span>
            </Row>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}
