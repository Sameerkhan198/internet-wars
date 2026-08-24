"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/money";
import type { CampaignDTO, CampaignScoreDTO, TeamDTO } from "@/lib/types";
import ShareCard from "./ShareCard";
import { rememberContribution } from "@/lib/myContributions";

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];

type Step = "form" | "submitting" | "pending" | "success" | "failed" | "error";

export default function ContributionModal({
  campaign,
  team,
  score,
  onClose,
}: {
  campaign: CampaignDTO;
  team: TeamDTO;
  score: CampaignScoreDTO;
  onClose: () => void;
}) {
  const [amountRupees, setAmountRupees] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [submittedAmount, setSubmittedAmount] = useState<number>(0);

  const effectiveAmount = customAmount ? Number(customAmount) : amountRupees;
  const minRupees = campaign.minimumContribution / 100;
  const maxRupees = campaign.maximumContribution / 100;
  const canSubmit =
    effectiveAmount >= minRupees &&
    effectiveAmount <= maxRupees &&
    (isAnonymous || displayName.trim().length > 0);

  useEffect(() => {
    if (step !== "pending" || !contributionId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/contribute/${contributionId}/status`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "SUCCESS") {
          rememberContribution(contributionId, team, submittedAmount, campaign.slug);
          setStep("success");
          return;
        }
        if (data.status === "FAILED" || data.status === "CANCELLED") {
          setStep("failed");
          return;
        }
        if (attempts > 20) {
          setErrorMessage(
            "We've received your payment request, but the payment provider hasn't confirmed it yet. Your support will appear on the scoreboard only after verification."
          );
          return;
        }
        setTimeout(poll, 1200);
      } catch {
        if (!cancelled) setTimeout(poll, 1500);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [step, contributionId, team, submittedAmount, campaign.slug]);

  async function handleSubmit() {
    setStep("submitting");
    setErrorMessage("");
    setSubmittedAmount(effectiveAmount);
    try {
      const res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignSlug: campaign.slug,
          teamSlug: team.slug,
          amount: Math.round(effectiveAmount * 100),
          displayName: isAnonymous ? "Anonymous" : displayName,
          isAnonymous,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStep("error");
        return;
      }
      setContributionId(data.contributionId);
      setStep("pending");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-md bg-background-elevated border border-border rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black uppercase tracking-tight">
            Back <span style={{ color: `var(${team.slug === "stocks" ? "--team-a" : "--team-b"})` }}>{team.name}</span>
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none px-2" aria-label="Close">
            ×
          </button>
        </div>

        {step === "form" && (
          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted mb-2">Quick amounts</div>
              <div className="grid grid-cols-5 gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setAmountRupees(amt);
                      setCustomAmount("");
                    }}
                    className={`rounded-lg py-2 text-sm font-bold border transition-colors ${
                      !customAmount && amountRupees === amt
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted mb-2 block">Custom amount</label>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 focus-within:border-foreground/50">
                <span className="text-muted">₹</span>
                <input
                  type="number"
                  min={minRupees}
                  max={maxRupees}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`${minRupees} - ${maxRupees.toLocaleString("en-IN")}`}
                  className="bg-transparent outline-none flex-1 numeric"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted mb-2 block">Username</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter username"
                disabled={isAnonymous}
                maxLength={30}
                className="w-full rounded-lg border border-border px-3 py-2 bg-transparent outline-none focus:border-foreground/50 disabled:opacity-40"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="accent-foreground"
              />
              Support anonymously
            </label>

            <div className="rounded-lg border border-border p-4 bg-black/20 text-sm space-y-1">
              <div className="text-muted">You are supporting:</div>
              <div className="font-bold">{team.name}</div>
              <div className="text-muted mt-2">Contribution:</div>
              <div className="numeric font-bold text-lg">{formatINR(Math.round(effectiveAmount * 100) || 0)}</div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              This is a voluntary community contribution, not an investment or bet. It does not guarantee any
              financial return.
            </p>

            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full rounded-lg py-3 font-bold uppercase tracking-wide bg-foreground text-background disabled:opacity-30 transition-opacity"
            >
              Continue
            </button>
          </div>
        )}

        {step === "submitting" && <CenteredMessage title="Processing..." subtitle="Setting up your contribution." />}

        {step === "pending" && (
          <CenteredMessage
            title="Verifying payment..."
            subtitle={
              errorMessage ||
              "We're confirming your payment. This usually takes a few seconds. Your support will appear on the scoreboard once verified."
            }
            spinner
          />
        )}

        {step === "success" && contributionId && (
          <ShareCard
            campaign={campaign}
            team={team}
            score={score}
            amountRupees={Math.round(submittedAmount)}
            onClose={onClose}
          />
        )}

        {step === "failed" && (
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h3 className="font-bold text-lg">Payment didn&apos;t go through</h3>
            <p className="text-sm text-muted">
              The payment provider couldn&apos;t confirm this transaction. Nothing was added to the scoreboard. You
              can try again.
            </p>
            <button
              onClick={() => setStep("form")}
              className="w-full rounded-lg py-3 font-bold uppercase tracking-wide bg-foreground text-background"
            >
              Try again
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="text-center space-y-4">
            <div className="text-4xl">❌</div>
            <h3 className="font-bold text-lg">Couldn&apos;t process that</h3>
            <p className="text-sm text-muted">{errorMessage}</p>
            <button
              onClick={() => setStep("form")}
              className="w-full rounded-lg py-3 font-bold uppercase tracking-wide bg-foreground text-background"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CenteredMessage({ title, subtitle, spinner }: { title: string; subtitle: string; spinner?: boolean }) {
  return (
    <div className="text-center py-8 space-y-4">
      {spinner && (
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      )}
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-muted max-w-xs mx-auto">{subtitle}</p>
    </div>
  );
}
