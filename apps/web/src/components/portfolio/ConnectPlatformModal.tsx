"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AaConnectModal } from "./AaConnectModal";
import { ShieldCheck, Sparkles } from "lucide-react";

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
  const [showAaModal, setShowAaModal] = useState(false);
  const [aaSelectedBroker, setAaSelectedBroker] = useState<string | null>(null);

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
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to connect. Try again.";
      setError(Array.isArray(msg) ? msg.join("; ") : msg);
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!selectedBroker) return setError("Please select a broker.");

    // Trigger AA flow for automated sync
    setAaSelectedBroker(getBrokerConfig(selectedBroker).label);
    setShowAaModal(true);
  };

  const handleOpenDirectAa = () => {
    setAaSelectedBroker(null);
    setShowAaModal(true);
  };

  return (
    <>
      <Dialog open={open && !showAaModal} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
              <span>Connect Broker 🔗</span>
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs"
              >
                Open Banking
              </Badge>
            </DialogTitle>
            <p className="text-xs text-slate-400">
              Select your demat platform to aggregate all stock & asset holdings in your unified
              dashboard.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Featured AA 1-Click Sync Banner */}
            <button
              type="button"
              onClick={handleOpenDirectAa}
              className="w-full p-3.5 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-950/60 via-indigo-950/50 to-slate-900 text-left hover:border-blue-400 transition-all group cursor-pointer shadow-lg shadow-blue-500/5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  1-Click Multi-Demat Sync (RBI AA)
                </span>
                <Badge className="bg-blue-600 text-white text-[10px] font-semibold">
                  RECOMMENDED
                </Badge>
              </div>
              <p className="text-[11.5px] text-slate-300">
                Sync Groww, AngelOne, Zerodha & CDSL/NSDL holdings in 1 OTP flow via Setu Account
                Aggregator.
              </p>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Powered by RBI AA Framework
                →
              </div>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Or Select Specific Platform
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Broker Grid */}
            <div className="grid grid-cols-2 gap-2">
              {CONNECTABLE_BROKERS.map((code) => {
                const cfg = getBrokerConfig(code);
                const active = selectedBroker === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setSelectedBroker(code);
                      setAccountName("");
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      active
                        ? "border-blue-500 bg-blue-950/40 ring-1 ring-blue-500"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900",
                    )}
                  >
                    <span className="text-xl">{cfg.emoji}</span>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          active ? "text-blue-400" : "text-slate-200",
                        )}
                      >
                        {cfg.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Account name */}
            {selectedBroker && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="account-name" className="text-xs text-slate-300">
                  Account name (optional)
                </Label>
                <Input
                  id="account-name"
                  className="bg-slate-900 border-slate-800 text-white"
                  placeholder={`e.g. My ${getBrokerConfig(selectedBroker).label} Account`}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-slate-800 hover:bg-slate-900 text-slate-300"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                onClick={handleSubmit}
                disabled={!selectedBroker || isPending}
              >
                Connect via AA 🔗
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded RBI AA Flow Modal */}
      <AaConnectModal
        open={showAaModal}
        onClose={() => {
          setShowAaModal(false);
          onClose();
        }}
        portfolioId={portfolioId}
        selectedBroker={aaSelectedBroker}
      />
    </>
  );
}
