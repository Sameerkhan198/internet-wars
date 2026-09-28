"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { sideVisual } from "@/lib/sides";
import { track } from "@/lib/analytics";
import { amountBucket } from "@/lib/analyticsEvents";
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

  // Which side, from data — never from a team's slug.
  const slot: "a" | "b" = team.id === score.teamA.teamId ? "a" : "b";
  const visual = sideVisual(team.accentTheme, slot);

  const effectiveAmount = customAmount ? Number(customAmount) : amountRupees;
  const minRupees = campaign.minimumContribution / 100;
  const maxRupees = campaign.maximumContribution / 100;
  const amountValid = Number.isFinite(effectiveAmount) && effectiveAmount >= minRupees && effectiveAmount <= maxRupees;
  const nameValid = isAnonymous || displayName.trim().length > 0;
  const canSubmit = amountValid && nameValid;

  const titleId = useId();
  const amountErrId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const busy = step === "submitting" || step === "pending";
  const openedTracked = useRef(false);

  // Dialog behaviour: focus inside on open, Escape to close (not mid-payment),
  // Tab stays inside, focus returns to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>("button, input, [href], select, textarea");
    first?.focus();
    if (!openedTracked.current) {
      openedTracked.current = true; // once per open, even under dev StrictMode
      track("contribution_flow_opened", { side: slot }, campaign.slug);
    }
    return () => opener?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href]")];
      if (f.length === 0) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

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
          track("demo_contribution_completed", { side: slot, outcome: "success" }, campaign.slug);
          setStep("success");
          return;
        }
        if (data.status === "FAILED" || data.status === "CANCELLED") {
          track("demo_contribution_completed", { side: slot, outcome: "failed" }, campaign.slug);
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
  }, [step, contributionId, team, submittedAmount, campaign.slug, slot]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setStep("submitting");
    setErrorMessage("");
    setSubmittedAmount(effectiveAmount);
    track(
      "demo_contribution_started",
      { side: slot, bucket: amountBucket(effectiveAmount, !customAmount), anonymous: isAnonymous },
      campaign.slug
    );
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
      const data = await res.json().catch(() => ({}));
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="panel w-full sm:max-w-md !rounded-b-none sm:!rounded-md max-h-[90vh] overflow-y-auto"
      >
        <div className="panel-header">
          <span id={titleId} className="flex items-center gap-2 text-foreground normal-case tracking-normal font-sans text-sm font-semibold">
            <span aria-hidden="true" style={{ color: visual.color }}>
              {visual.glyph}
            </span>
            Back <span style={{ color: visual.color }}>{team.name}</span>
          </span>
          <button
            onClick={onClose}
            disabled={busy}
            className="min-h-9 min-w-9 -mr-2 text-muted hover:text-foreground text-lg leading-none disabled:opacity-30"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {step === "form" && (
            <div className="space-y-5">
              <fieldset>
                <legend className="label mb-2">Quick amounts</legend>
                <div className="grid grid-cols-5 gap-2">
                  {QUICK_AMOUNTS.map((amt) => {
                    const selected = !customAmount && amountRupees === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setAmountRupees(amt);
                          setCustomAmount("");
                          track("amount_selected", { side: slot, bucket: amountBucket(amt, true) }, campaign.slug);
                        }}
                        className={`min-h-11 rounded font-mono text-sm font-bold border transition-colors ${
                          selected ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"
                        }`}
                      >
                        ₹{amt}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor="cm-custom" className="label block mb-2">
                  Custom amount
                </label>
                <div className="flex items-center gap-2 rounded border border-border px-3 py-2 focus-within:border-foreground/50">
                  <span className="text-muted" aria-hidden="true">
                    ₹
                  </span>
                  <input
                    id="cm-custom"
                    type="number"
                    inputMode="numeric"
                    min={minRupees}
                    max={maxRupees}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onBlur={() => customAmount && track("amount_selected", { side: slot, bucket: "custom" }, campaign.slug)}
                    placeholder={`${minRupees} – ${maxRupees.toLocaleString("en-IN")}`}
                    aria-invalid={!!customAmount && !amountValid}
                    aria-describedby={amountErrId}
                    className="bg-transparent outline-none flex-1 numeric"
                  />
                </div>
                <p id={amountErrId} className={`mt-1 text-xs ${customAmount && !amountValid ? "text-danger" : "text-muted"}`}>
                  Between ₹{minRupees.toLocaleString("en-IN")} and ₹{maxRupees.toLocaleString("en-IN")}.
                </p>
              </div>

              <div>
                <label htmlFor="cm-name" className="label block mb-2">
                  Display name
                </label>
                <input
                  id="cm-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={isAnonymous ? "Hidden — you'll show as Anonymous Supporter" : "Shown on the leaderboard"}
                  disabled={isAnonymous}
                  maxLength={30}
                  autoComplete="nickname"
                  className="w-full rounded border border-border px-3 py-2 bg-transparent outline-none focus:border-foreground/50 disabled:opacity-40"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer min-h-11">
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="h-4 w-4 accent-foreground" />
                Support anonymously
              </label>

              <div className="rounded border border-border p-4 bg-black/20 text-sm flex items-center justify-between gap-4">
                <div>
                  <div className="label !text-[10px]">Supporting</div>
                  <div className="font-semibold" style={{ color: visual.color }}>
                    {team.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="label !text-[10px]">Contribution</div>
                  <div className="numeric font-bold text-lg">{amountValid ? formatINR(Math.round(effectiveAmount * 100)) : "—"}</div>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                This is a voluntary community contribution, not an investment or bet. It does not guarantee any financial
                return.
              </p>

              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full min-h-11 rounded font-mono font-bold uppercase tracking-wider text-black disabled:opacity-30 transition-opacity"
                style={{ background: visual.color }}
              >
                {visual.glyph} Continue
              </button>
              {!nameValid && (
                <p className="text-xs text-muted -mt-3 text-center">Enter a display name or choose anonymous.</p>
              )}
            </div>
          )}

          {step === "submitting" && <CenteredMessage title="Processing…" subtitle="Setting up your contribution." spinner />}

          {step === "pending" && (
            <CenteredMessage
              title="Verifying payment…"
              subtitle={
                errorMessage ||
                "We're confirming your payment. This usually takes a few seconds. Your support appears on the scoreboard only once verified."
              }
              spinner
            />
          )}

          {step === "success" && contributionId && (
            <ShareCard campaign={campaign} team={team} slot={slot} score={score} onClose={onClose} />
          )}

          {step === "failed" && (
            <Outcome
              tone="warn"
              title="Payment didn't go through"
              body="The payment provider couldn't confirm this transaction. Nothing was added to the scoreboard. You can try again."
              action="Try again"
              onAction={() => setStep("form")}
            />
          )}

          {step === "error" && (
            <Outcome tone="error" title="Couldn't process that" body={errorMessage} action="Back" onAction={() => setStep("form")} />
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ title, subtitle, spinner }: { title: string; subtitle: string; spinner?: boolean }) {
  return (
    <div className="text-center py-8 space-y-4" role="status" aria-live="polite">
      {spinner && <div className="mx-auto h-8 w-8 rounded-full border-2 border-muted border-t-foreground animate-spin motion-reduce:animate-none" />}
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-muted max-w-xs mx-auto">{subtitle}</p>
    </div>
  );
}

function Outcome({
  tone,
  title,
  body,
  action,
  onAction,
}: {
  tone: "warn" | "error";
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="text-center space-y-4 py-2" role="alert">
      <div
        className="mx-auto inline-flex rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest"
        style={{ color: tone === "warn" ? "var(--signal)" : "var(--danger)", borderColor: tone === "warn" ? "var(--signal)" : "var(--danger)" }}
      >
        {tone === "warn" ? "Not verified" : "Error"}
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
      <button onClick={onAction} className="w-full min-h-11 rounded font-mono font-bold uppercase tracking-wider bg-foreground text-background">
        {action}
      </button>
    </div>
  );
}
