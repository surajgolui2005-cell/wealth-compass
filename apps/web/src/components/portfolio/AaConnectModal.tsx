"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Building2,
  RefreshCw,
} from "lucide-react";

interface AaConnectModalProps {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  selectedBroker?: string | null;
}

export function AaConnectModal({
  open,
  onClose,
  portfolioId,
  selectedBroker,
}: AaConnectModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"MOBILE" | "CONSENT_REDIRECT" | "FETCHING" | "SUCCESS">(
    "MOBILE",
  );
  const [mobileNumber, setMobileNumber] = useState("9999999999");
  const [otp, setOtp] = useState("123456");
  const [consentId, setConsentId] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [importedHoldings, setImportedHoldings] = useState<any[]>([]);
  const [error, setError] = useState("");

  // 1. Create Consent Mutation
  const createConsentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/aa/consent", {
        mobileNumber,
        portfolioId,
        broker: selectedBroker,
        brokerName: selectedBroker,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      setConsentId(data.consentId);
      setConsentUrl(data.consentUrl);
      setStep("CONSENT_REDIRECT");
    },
    onError: (e: any) => {
      setError(
        e?.response?.data?.message || e?.message || "Failed to initiate Setu AA consent request.",
      );
    },
  });

  // 2. Fetch Holdings Mutation after OTP approval
  const fetchHoldingsMutation = useMutation({
    mutationFn: async (cid: string) => {
      const res = await apiClient.post(`/aa/consent/${cid}/fetch`, {
        portfolioId,
        brokerName: selectedBroker,
      });
      return res.data?.data;
    },
    onSuccess: (data) => {
      setImportedHoldings(data.holdings || []);
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["provider-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-risk"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setStep("SUCCESS");
    },
    onError: (e: any) => {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to fetch holdings from Account Aggregator.",
      );
      setStep("CONSENT_REDIRECT");
    },
  });

  const handleStartConsent = () => {
    setError("");
    if (!mobileNumber || mobileNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    createConsentMutation.mutate();
  };

  const handleSimulateApproval = () => {
    setError("");
    setStep("FETCHING");
    if (consentId) {
      fetchHoldingsMutation.mutate(consentId);
    }
  };

  const handleReset = () => {
    setStep("MOBILE");
    setConsentId(null);
    setConsentUrl(null);
    setImportedHoldings([]);
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && handleReset()}>
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                🏦 1-Click Demat Sync
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-xs"
                >
                  RBI AA Framework
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {selectedBroker
                  ? `Sync holdings for ${selectedBroker}`
                  : "Connect Groww, AngelOne, Zerodha & CDSL/NSDL accounts"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* STEP 1: MOBILE ENTRY */}
        {step === "MOBILE" && (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-200">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                RBI & SEBI Account Aggregator (Setu Gateway)
              </div>
              <p className="text-slate-300">
                Fetches all stocks, mutual funds & deposits linked to your phone number across
                CDSL/NSDL depositories without sharing login passwords.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile-input" className="text-slate-200 text-sm font-medium">
                Registered Mobile Number
              </Label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  id="mobile-input"
                  className="pl-9 bg-slate-900 border-slate-800 text-white font-mono text-base tracking-wide"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="Enter 10-digit mobile"
                  maxLength={10}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                💡 Setu Sandbox Test Number:{" "}
                <span className="text-emerald-400 font-mono font-semibold">9999999999</span>
              </p>
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-800 hover:bg-slate-900"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/20"
                onClick={handleStartConsent}
                disabled={createConsentMutation.isPending}
              >
                {createConsentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initiating…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: SETU CONSENT VERIFICATION (SANDBOX OPTIMIZED) */}
        {step === "CONSENT_REDIRECT" && (
          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Setu AA Consent Created
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-[10px]">
                  ID: {consentId?.substring(0, 14)}...
                </Badge>
              </div>
              <p className="text-slate-300 text-[11.5px]">
                Consent request registered for mobile{" "}
                <span className="text-emerald-400 font-mono font-bold">{mobileNumber}</span> via
                Setu FIU UAT Gateway.
              </p>
            </div>

            {/* Setu Sandbox Mock Verification Card */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Sandbox Test Verification
                </span>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono">
                  Setu FIP-2
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sandbox-otp" className="text-xs text-slate-300">
                  Enter Sandbox OTP
                </Label>
                <Input
                  id="sandbox-otp"
                  className="bg-slate-950 border-slate-700 text-emerald-400 font-mono tracking-widest text-center text-lg font-bold"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                />
                <p className="text-[11px] text-slate-400 text-center">
                  Static Test OTP:{" "}
                  <span className="text-emerald-400 font-mono font-bold">123456</span>
                </p>
              </div>

              {consentUrl && (
                <div className="text-center pt-1">
                  <a
                    href={consentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Open Setu Webview Screen in new tab ↗
                  </a>
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-slate-800 text-slate-300"
                onClick={() => setStep("MOBILE")}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-600/20"
                onClick={handleSimulateApproval}
              >
                Approve & Sync Holdings
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: FETCHING DATA */}
        {step === "FETCHING" && (
          <div className="py-8 text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Decrypting Demat Holdings…</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Fetching stocks across Groww, AngelOne & Zerodha via CDSL/NSDL depositories via Setu
                AA.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="space-y-4 pt-2">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Holdings Synced Successfully!</h4>
              <p className="text-xs text-slate-400">
                Imported {importedHoldings.length} holdings into your unified portfolio
              </p>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {importedHoldings.map((h, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{h.companyName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {h.isin} • Qty: {h.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-400 font-mono">
                      ₹{h.currentValue?.toLocaleString("en-IN")}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-300 border-blue-500/20"
                    >
                      {h.broker}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium mt-2"
              onClick={handleReset}
            >
              Done & View Portfolio
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
