"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
}

export function ImportCsvModal({ open, onClose, portfolioId }: ImportCsvModalProps) {
  const queryClient = useQueryClient();
  const [selectedBroker, setSelectedBroker] = useState<string>("GROWW");
  const [csvContent, setCsvContent] = useState("");
  const [error, setError] = useState("");

  const { mutate: importCsv, isPending } = useMutation({
    mutationFn: async () => {
      // Ensure provider account exists for this broker
      try {
        const cfg = getBrokerConfig(selectedBroker);
        await apiClient.post("/providers/accounts", {
          portfolioId,
          providerCode: selectedBroker,
          accountName: `${cfg.label} Import`,
          status: "CONNECTED",
        });
      } catch {
        // Proceed if account already exists
      }

      return apiClient.post("/providers/csv/import", {
        portfolioId,
        csvContent: csvContent.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["provider-accounts"] });
      onClose();
      setCsvContent("");
      setError("");
    },
    onError: (e: any) => {
      setError(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          "Failed to import CSV. Please ensure column headers match.",
      );
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || "");
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            Import Broker Statement (CSV)
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Import holdings statements downloaded from Groww, Angel One, or Zerodha.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Select Broker Platform */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Broker Source
            </Label>
            <div className="grid grid-cols-4 gap-1.5 mt-1.5">
              {CONNECTABLE_BROKERS.map((code) => {
                const cfg = getBrokerConfig(code);
                const active = selectedBroker === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedBroker(code)}
                    className={cn(
                      "flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all text-xs cursor-pointer",
                      active
                        ? "border-primary bg-primary/15 text-primary shadow-xs font-semibold ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/40 text-foreground",
                    )}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="truncate flex-1">{cfg.shortLabel}</span>
                    {active && <Check className="h-3 w-3 ml-auto text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* File upload input */}
          <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="text-sm font-semibold">Click to upload CSV file from broker</span>
              <span className="text-xs text-muted-foreground">Supported format: .csv</span>
            </label>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Or Paste CSV Data Directly:
            </Label>
          </div>

          <Textarea
            rows={7}
            placeholder="symbol,quantity,price,type,date&#10;RELIANCE,10,2900,BUY,2026-01-15&#10;INFY,20,1800,BUY,2026-02-01"
            value={csvContent}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsvContent(e.target.value)}
            className="font-mono text-xs"
          />

          {error && (
            <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => importCsv()}
              disabled={!csvContent.trim() || isPending}
            >
              {isPending ? "Importing Positions…" : "Import Positions"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
