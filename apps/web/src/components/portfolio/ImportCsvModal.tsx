"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { apiClient } from "@/lib/api-client";
import { CONNECTABLE_BROKERS, getBrokerConfig } from "@/lib/broker-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileSpreadsheet, Check, FileCheck, X } from "lucide-react";
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
  const [fileName, setFileName] = useState<string>("");
  const [parsedRowsCount, setParsedRowsCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  const { mutate: importCsv, isPending } = useMutation({
    mutationFn: async () => {
      // Ensure provider account exists for this broker and capture its ID
      let providerAccountId: string | undefined;
      try {
        const cfg = getBrokerConfig(selectedBroker);
        const accountRes = await apiClient.post<{ id: string }>("/providers/accounts", {
          portfolioId,
          providerCode: selectedBroker,
          accountName: `${cfg.label} Import`,
          status: "CONNECTED",
        });
        providerAccountId = accountRes.data?.id;
      } catch {
        // Account may already exist — fetch existing ID
        try {
          const accountsRes = await apiClient.get<{
            accounts: { id: string; providerCode: string }[];
          }>("/providers/accounts");
          const existing = accountsRes.data?.accounts?.find(
            (a) => a.providerCode === selectedBroker,
          );
          providerAccountId = existing?.id;
        } catch {
          // Proceed without providerAccountId if all else fails
        }
      }

      const res = await apiClient.post<any>("/providers/csv/import", {
        portfolioId,
        csvContent: csvContent.trim(),
        providerAccountId,
      });

      if (res.data?.importedCount === 0) {
        throw new Error(
          res.data?.errors?.[0] ||
            "No valid holding positions found in this statement. Please check the columns and ensure stock symbols and quantities are present.",
        );
      }

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["holdings", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["provider-accounts"] });
      handleClose();
    },
    onError: (e: any) => {
      setError(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          "Failed to import file. Please ensure column headers match expected format (e.g., symbol, quantity, price).",
      );
    },
  });

  const handleClose = () => {
    onClose();
    setCsvContent("");
    setFileName("");
    setParsedRowsCount(null);
    setError("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");

    const isExcel =
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel";

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];

          if (!firstSheetName) {
            throw new Error("No readable worksheet found in this Excel file.");
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);

          if (!csvText || !csvText.trim()) {
            throw new Error("The first sheet in this Excel file appears to be empty.");
          }

          setCsvContent(csvText);
          const rowCount = csvText
            .trim()
            .split("\n")
            .filter((l) => l.trim()).length;
          setParsedRowsCount(Math.max(0, rowCount - 1)); // excluding header
        } catch (err: any) {
          setError(
            err?.message ||
              "Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls document.",
          );
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text || "");
        if (text) {
          const rowCount = text
            .trim()
            .split("\n")
            .filter((l) => l.trim()).length;
          setParsedRowsCount(Math.max(0, rowCount - 1));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearFile = () => {
    setFileName("");
    setCsvContent("");
    setParsedRowsCount(null);
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            Import Broker Statement (CSV / Excel)
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload statements directly from Groww, Angel One, Zerodha, Upstox or custom
            spreadsheets.
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
              accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="statement-file-input"
            />
            <label
              htmlFor="statement-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
              <span className="text-sm font-semibold">
                Click to upload Excel (.xlsx, .xls) or CSV statement
              </span>
              <span className="text-xs text-muted-foreground">
                Supported formats: <strong className="text-foreground">.xlsx</strong>,{" "}
                <strong className="text-foreground">.xls</strong>,{" "}
                <strong className="text-foreground">.csv</strong>
              </span>
            </label>
          </div>

          {/* File loaded banner */}
          {fileName && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-medium">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  Loaded: <strong>{fileName}</strong>
                  {parsedRowsCount !== null && (
                    <span className="text-muted-foreground ml-1.5">
                      ({parsedRowsCount} data {parsedRowsCount === 1 ? "row" : "rows"} detected)
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearFile}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
                title="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Or Preview / Paste Statement Data:
            </Label>
          </div>

          <Textarea
            rows={6}
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
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={isPending}>
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
