"use client";

import { useRef, useState } from "react";
import { formatINRCompact } from "@/lib/money";
import { sideVisual } from "@/lib/sides";
import { track } from "@/lib/analytics";
import type { ShareChannel } from "@/lib/share";
import type { CampaignDTO, CampaignScoreDTO, TeamDTO } from "@/lib/types";

/**
 * Post-support share card. Every number comes from `score`, the latest
 * server-verified battle totals held by BattleView (refreshed by polling) —
 * nothing is estimated here. The share text states the side and the current
 * verified standing; it does not include the supporter's own amount.
 */
export function buildShareText(teamName: string, isLeading: boolean, isEven: boolean, share: number, gap: string, supporters: number) {
  const standing = isEven
    ? "It's dead even right now"
    : isLeading
      ? `It leads with ${share.toFixed(1)}% of verified support`
      : `It's ${gap} behind with ${share.toFixed(1)}% of verified support`;
  return `I backed ${teamName} in Internet Wars. ${standing} (${supporters.toLocaleString("en-IN")} supporters so far). Pick your side:`;
}

export default function ShareCard({
  campaign,
  team,
  slot,
  score,
  onClose,
}: {
  campaign: CampaignDTO;
  team: TeamDTO;
  slot: "a" | "b";
  score: CampaignScoreDTO;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const visual = sideVisual(team.accentTheme, slot);
  const mine = slot === "a" ? score.teamA : score.teamB;
  const isEven = score.leaderTeamId === null;
  const isLeading = score.leaderTeamId === team.id;
  const supporters = score.teamA.supporterCount + score.teamB.supporterCount;
  const gap = formatINRCompact(score.differenceAmount);
  const url = typeof window !== "undefined" ? `${window.location.origin}/` : "";
  const text = buildShareText(team.name, isLeading, isEven, mine.percentage, gap, supporters);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function record(channel: ShareChannel) {
    track("share_clicked", { channel }, campaign.slug);
    fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignSlug: campaign.slug, channel }),
    }).catch(() => {});
  }

  function open(channel: "whatsapp" | "x" | "linkedin") {
    const t = encodeURIComponent(text);
    const u = encodeURIComponent(url);
    const links = {
      whatsapp: `https://wa.me/?text=${t}%20${u}`,
      x: `https://x.com/intent/post?text=${t}&url=${u}`,
      // LinkedIn's share endpoint only accepts a URL; the page's own OG tags supply the preview.
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    };
    record(channel);
    window.open(links[channel], "_blank", "noopener,noreferrer");
  }

  async function nativeShare() {
    record("native");
    try {
      await navigator.share({ title: "Internet Wars", text, url });
    } catch {
      // user dismissed the sheet
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
    record("copy_link");
  }

  function download() {
    const canvas = canvasRef.current!;
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, 1080, 1080);
    const glow = ctx.createRadialGradient(slot === "a" ? 0 : 1080, 0, 0, slot === "a" ? 0 : 1080, 0, 900);
    glow.addColorStop(0, visual.dim);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1080);

    const mono = "'JetBrains Mono Variable', ui-monospace, Consolas, monospace";
    const sans = "'IBM Plex Sans Variable', system-ui, sans-serif";
    ctx.fillStyle = visual.color;
    ctx.font = `700 40px ${mono}`;
    ctx.fillText(`${visual.glyph} I BACKED`, 80, 170);
    ctx.fillStyle = "#e6edf3";
    ctx.font = `700 92px ${sans}`;
    wrap(ctx, team.name, 80, 280, 920, 104);

    ctx.fillStyle = visual.color;
    ctx.font = `700 150px ${mono}`;
    ctx.fillText(`${mine.percentage.toFixed(1)}%`, 80, 600);
    ctx.fillStyle = "#7d8896";
    ctx.font = `500 34px ${mono}`;
    ctx.fillText("OF VERIFIED SUPPORT", 84, 660);

    ctx.fillStyle = "#e6edf3";
    ctx.font = `500 38px ${sans}`;
    ctx.fillText(isEven ? "Dead even right now" : isLeading ? "Leading right now" : `${gap} behind right now`, 80, 760);
    ctx.fillText(`${supporters.toLocaleString("en-IN")} supporters so far`, 80, 815);

    ctx.fillStyle = "#273142";
    ctx.fillRect(80, 900, 920, 2);
    ctx.fillStyle = "#7d8896";
    ctx.font = `600 30px ${mono}`;
    ctx.fillText("INTERNET/WARS", 80, 960);
    ctx.font = `400 28px ${mono}`;
    ctx.fillText(url.replace(/^https?:\/\//, "").replace(/\/$/, ""), 80, 1005);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `internet-wars-${team.slug}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
    record("download");
  }

  return (
    <div className="space-y-5">
      <div className="text-center" role="status">
        <div className="label mb-1" style={{ color: "var(--bull)" }}>
          Verified
        </div>
        <p className="font-semibold">Your support is on the scoreboard.</p>
      </div>

      <div className="rounded border p-5 space-y-2" style={{ borderColor: visual.color, background: `linear-gradient(180deg, ${visual.dim}, transparent)` }}>
        <div className="label" style={{ color: visual.color }}>
          {visual.glyph} I backed {team.shortName}
        </div>
        <div className="numeric text-4xl font-bold" style={{ color: visual.color }}>
          {mine.percentage.toFixed(1)}%
        </div>
        <div className="text-sm text-muted">
          {isEven ? "Dead even right now" : isLeading ? "Leading right now" : `${gap} behind right now`} ·{" "}
          {supporters.toLocaleString("en-IN")} supporters
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {canNativeShare && (
        <button onClick={nativeShare} className={`${btn} w-full bg-foreground text-background border-foreground`}>
          Share…
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => open("whatsapp")} className={btn}>WhatsApp</button>
        <button onClick={() => open("x")} className={btn}>X</button>
        <button onClick={() => open("linkedin")} className={btn}>LinkedIn</button>
        <button onClick={download} className={btn}>Download card</button>
      </div>
      <button onClick={copyLink} className={`${btn} w-full`} aria-live="polite">
        {copied ? "Copied!" : "Copy link"}
      </button>

      <button onClick={onClose} className="w-full min-h-11 rounded font-mono text-sm font-bold uppercase tracking-wider border border-border hover:border-foreground/40">
        Done
      </button>
    </div>
  );
}

const btn = "min-h-11 rounded border border-border text-sm font-semibold hover:border-foreground/40 transition-colors";

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = w;
      if (++lines >= 2) break;
    } else line = test;
  }
  if (lines < 2) ctx.fillText(line, x, y + lines * lineHeight);
}
