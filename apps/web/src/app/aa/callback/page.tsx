"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ArrowRight, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function AaCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"LOADING" | "SUCCESS" | "FAILED">("LOADING");
  const [consentId, setConsentId] = useState<string | null>(null);

  useEffect(() => {
    const cid = searchParams.get("consent_id") || searchParams.get("id");
    const resState = searchParams.get("ecres") || searchParams.get("status");

    setConsentId(cid);

    if (resState === "SUCCESS" || resState === "APPROVED" || resState === "ACTIVE" || cid) {
      setStatus("SUCCESS");
      // If opened in popup window, communicate with parent
      if (window.opener) {
        window.opener.postMessage({ type: "SETU_AA_SUCCESS", consentId: cid }, "*");
        setTimeout(() => window.close(), 2000);
      }
    } else if (resState === "REJECTED" || resState === "FAILED") {
      setStatus("FAILED");
    } else {
      setStatus("SUCCESS");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6" />
        </div>

        {status === "LOADING" && (
          <div className="space-y-3 py-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-white">Verifying Setu AA Consent…</h2>
            <p className="text-xs text-slate-400">
              Communicating with RBI Account Aggregator Gateway.
            </p>
          </div>
        )}

        {status === "SUCCESS" && (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Consent Approved!</h2>
            <p className="text-xs text-slate-300">
              Your Demat holdings connection has been successfully authorized via Setu AA.
            </p>
            {consentId && (
              <p className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
                Consent ID: {consentId}
              </p>
            )}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium mt-4"
              onClick={() => router.push("/dashboard")}
            >
              Return to Dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        )}

        {status === "FAILED" && (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Consent Authorization Failed</h2>
            <p className="text-xs text-slate-300">
              The consent approval request was cancelled or declined.
            </p>
            <Button
              variant="outline"
              className="w-full border-slate-800 text-slate-300 mt-4"
              onClick={() => router.push("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AaCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <AaCallbackContent />
    </Suspense>
  );
}
