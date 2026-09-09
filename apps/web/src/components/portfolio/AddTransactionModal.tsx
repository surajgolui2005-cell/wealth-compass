"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlusCircle, Check } from "lucide-react";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
}

export function AddTransactionModal({ open, onClose, portfolioId }: AddTransactionModalProps) {
  const queryClient = useQueryClient();

  const [selectedBroker, setSelectedBroker] = useState<string>("GROWW");
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [transactedAt, setTransactedAt] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");

  // Fetch existing provider accounts to see if an account already exists for this broker
  const { data: accountsData } = useQuery({
    queryKey: ["provider-accounts"],
    queryFn: async () => {
      const res = await apiClient.get("/providers/accounts");
      return (res as any).accounts ?? (res as any).data?.accounts ?? [];
    },
    enabled: open,
  });

  const { mutate: recordTx, isPending } = useMutation({
    mutationFn: async () => {
      let providerAccountId: string | undefined;

      // 1. Check if user already has an account for this broker
      const existing = (accountsData || []).find((a: any) => a.providerCode === selectedBroker);

      if (existing) {
        providerAccountId = existing.id;
      } else {
        // Create a provider account for this broker
        try {
          const cfg = getBrokerConfig(selectedBroker);
          const newAccRes = await apiClient.post("/providers/accounts", {
            portfolioId,
            providerCode: selectedBroker,
            accountName: `${cfg.label} Account`,
            status: "CONNECTED",
          });
          const newAcc = (newAccRes as any).data ?? newAccRes;
          providerAccountId = newAcc?.id;
        } catch {
          // If creation fails, proceed without providerAccountId
        }
      }

      // 2. Record transaction
      return apiClient.post("/transactions", {
        portfolioId,
        symbol: symbol.trim().toUpperCase(),
        type,
        quantity: parseFloat(quantity),
        pricePerUnit: parseFloat(pricePerUnit),
        transactedAt: new Date(transactedAt).toISOString(),
        providerAccountId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["provider-accounts"] });
      onClose();
      // Reset form
      setSymbol("");
      setQuantity("");
      setPricePerUnit("");
      setError("");
    },
    onError: (e: any) => {
      setError(
        e?.response?.data?.message || e?.message || "Failed to add asset. Please check inputs.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!symbol.trim()) return setError("Stock symbol is required (e.g. RELIANCE, INFY)");
    if (!quantity || parseFloat(quantity) <= 0)
      return setError("Please enter a valid quantity greater than 0");
    if (!pricePerUnit || parseFloat(pricePerUnit) <= 0)
      return setError("Please enter a valid buy price");

    recordTx();
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            Add Asset to Portfolio
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select the broker platform where you bought this stock (Groww, Angel One, etc.) so it
            shows with that platform’s badge.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Platform Selector */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Broker Platform
            </Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {CONNECTABLE_BROKERS.map((code) => {
                const cfg = getBrokerConfig(code);
                const active = selectedBroker === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedBroker(code)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs font-medium",
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm font-semibold"
                        : "border-border hover:bg-muted/40 text-foreground",
                    )}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="truncate">{cfg.shortLabel}</span>
                    {active && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type Toggle: Buy / Sell */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "BUY" ? "default" : "outline"}
              className={cn(
                "flex-1",
                type === "BUY" && "bg-emerald-600 hover:bg-emerald-700 text-white",
              )}
              onClick={() => setType("BUY")}
            >
              Buy Position
            </Button>
            <Button
              type="button"
              variant={type === "SELL" ? "default" : "outline"}
              className={cn(
                "flex-1",
                type === "SELL" && "bg-rose-600 hover:bg-rose-700 text-white",
              )}
              onClick={() => setType("SELL")}
            >
              Sell Position
            </Button>
          </div>

          {/* Stock Symbol */}
          <div className="space-y-1.5">
            <Label htmlFor="symbol">Stock Symbol / Ticker</Label>
            <Input
              id="symbol"
              placeholder="e.g. RELIANCE, INFY, TCS, HDFCBANK"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Tip: Enter standard NSE/BSE ticker symbol.
            </p>
          </div>

          {/* Quantity and Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity (Shares)</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0.0001"
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Buy Price per Unit (₹)</Label>
              <Input
                id="price"
                type="number"
                step="any"
                min="0.01"
                placeholder="2850.50"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="transactedAt">Transaction Date</Label>
            <Input
              id="transactedAt"
              type="date"
              value={transactedAt}
              onChange={(e) => setTransactedAt(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isPending}
            >
              {isPending ? "Saving Asset…" : "Save Asset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
