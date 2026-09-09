"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ConnectPlatformModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
}

export function ConnectPlatformModal({ open, onClose, portfolioId }: ConnectPlatformModalProps) {
  const queryClient = useQueryClient();
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      return apiClient.post("/providers/accounts", {
        portfolioId,
        providerCode: selectedBroker,
        accountName: accountName.trim() || getBrokerConfig(selectedBroker).label,
        status: "CONNECTED",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["provider-accounts", portfolioId] });
      onClose();
      setSelectedBroker(null);
      setAccountName("");
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? "Failed to connect. Try again.");
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!selectedBroker) return setError("Please select a broker.");
    mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Connect a Broker Account</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select which platform you hold assets on. You can then import your holdings via CSV.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Broker Grid */}
          <div className="grid grid-cols-2 gap-2">
            {CONNECTABLE_BROKERS.map((code) => {
              const cfg = getBrokerConfig(code);
              const active = selectedBroker === code;
              return (
                <button
                  key={code}
                  onClick={() => {
                    setSelectedBroker(code);
                    setAccountName("");
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "hover:border-muted-foreground/40 hover:bg-muted/40",
                  )}
                >
                  <span className="text-xl">{cfg.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Account name */}
          {selectedBroker && (
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Account name (optional)</Label>
              <Input
                id="account-name"
                placeholder={`e.g. My ${getBrokerConfig(selectedBroker).label} Account`}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSubmit}
              disabled={!selectedBroker || isPending}
            >
              {isPending ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
