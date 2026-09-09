"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, FileText } from "lucide-react";

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
}

const SAMPLE_CSV = `symbol,quantity,price,type,date
RELIANCE,15,2910.50,BUY,2026-01-10
INFY,30,1850.00,BUY,2026-02-15
TCS,10,3920.00,BUY,2026-03-01
HDFCBANK,25,1640.20,BUY,2026-03-05`;

export function ImportCsvModal({ open, onClose, portfolioId }: ImportCsvModalProps) {
  const queryClient = useQueryClient();
  const [csvContent, setCsvContent] = useState("");
  const [error, setError] = useState("");

  const { mutate: importCsv, isPending } = useMutation({
    mutationFn: async () => {
      return apiClient.post("/providers/csv/import", {
        portfolioId,
        csvContent: csvContent.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      onClose();
      setCsvContent("");
      setError("");
    },
    onError: (e: any) => {
      setError(
        e?.response?.data?.message || "Failed to import CSV. Please ensure column headers match.",
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

  const handleUseSample = () => {
    setCsvContent(SAMPLE_CSV);
    setError("");
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

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Or Paste CSV Data Directly:
            </span>
            <button
              type="button"
              onClick={handleUseSample}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Load Sample Data
            </button>
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
