"use client";

import { useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import type { CampaignDTO, CampaignScoreDTO, TeamDTO } from "@/lib/types";

export default function ShareCard({
  campaign,
  team,
  score,
  amountRupees,
  onClose,
}: {
  campaign: CampaignDTO;
  team: TeamDTO;
  score: CampaignScoreDTO;
  amountRupees: number;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const isTeamA = team.slug === "stocks";
  const myScore = isTeamA ? score.teamA : score.teamB;
  const otherScore = isTeamA ? score.teamB : score.teamA;
  const accent = isTeamA ? "#22d3a8" : "#a78bfa";
  const behindBy = Math.max(0, otherScore.percentage - myScore.percentage);
  const url = typeof window !== "undefined" ? window.location.origin : "";

  const shareText = `I backed ${team.name} in Internet Wars! ${formatINR(amountRupees * 100)} contributed. ${team.shortName} is at ${myScore.percentage.toFixed(1)}% — help us take #1!`;

  function drawCard(): HTMLCanvasElement {
    const canvas = canvasRef.current!;
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#0d0f14");
    gradient.addColorStop(1, "#08090c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = accent;
    ctx.font = "bold 44px Arial";
    ctx.fillText(`I BACKED ${team.shortName}`, 80, 160);

    ctx.fillStyle = "#f4f5f7";
    ctx.font = "black 120px Arial";
    ctx.fillText(formatINR(amountRupees * 100), 80, 320);

    ctx.fillStyle = "#8b93a3";
    ctx.font = "32px Arial";
    ctx.fillText(team.name.toUpperCase(), 80, 400);

    ctx.fillStyle = accent;
    ctx.font = "bold 96px Arial";
    ctx.fillText(`${myScore.percentage.toFixed(1)}%`, 80, 540);

    ctx.fillStyle = "#f4f5f7";
    ctx.font = "36px Arial";
    const behindText =
      behindBy <= 0 ? "We're in the lead!" : `Only ${behindBy.toFixed(1)}% behind the other side`;
    ctx.fillText(behindText, 80, 610);

    ctx.strokeStyle = "#21242e";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 700, 960, 4);

    ctx.fillStyle = "#f4f5f7";
    ctx.font = "bold 40px Arial";
    ctx.fillText("Help us take #1", 80, 800);

    ctx.fillStyle = "#8b93a3";
    ctx.font = "28px Arial";
    ctx.fillText("INTERNET WARS", 80, 980);
    ctx.fillText("Indian Stock Market vs Forex Market", 80, 1020);

    return canvas;
  }

  function handleDownload() {
    const canvas = drawCard();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `internet-wars-${team.slug}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(url);
    await fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignSlug: campaign.slug, channel: "copy_link" }),
    }).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareTo(channel: "whatsapp" | "x" | "telegram") {
    const encoded = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(url);
    const links: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encoded}%20${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encoded}`,
    };
    fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignSlug: campaign.slug, channel }),
    }).catch(() => {});
    window.open(links[channel], "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border p-6 space-y-3"
        style={{ borderColor: accent, background: "linear-gradient(180deg, rgba(255,255,255,0.03), transparent)" }}
      >
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
          I backed {team.shortName}
        </div>
        <div className="numeric text-3xl font-black">{formatINR(amountRupees * 100)}</div>
        <div className="numeric text-4xl font-black" style={{ color: accent }}>
          {myScore.percentage.toFixed(1)}%
        </div>
        <div className="text-sm text-muted">
          {behindBy <= 0 ? "We're in the lead!" : `Only ${behindBy.toFixed(1)}% behind — help us take #1`}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-2 gap-2">
        <ShareButton onClick={() => shareTo("whatsapp")}>WhatsApp</ShareButton>
        <ShareButton onClick={() => shareTo("x")}>X</ShareButton>
        <ShareButton onClick={() => shareTo("telegram")}>Telegram</ShareButton>
        <ShareButton onClick={handleDownload}>Download Card</ShareButton>
      </div>
      <button
        onClick={handleCopyLink}
        className="w-full rounded-lg py-2.5 text-sm font-semibold border border-border hover:border-foreground/40 transition-colors"
      >
        {copied ? "Link copied!" : "Copy Link"}
      </button>

      <button
        onClick={onClose}
        className="w-full rounded-lg py-3 font-bold uppercase tracking-wide bg-foreground text-background"
      >
        Done
      </button>
    </div>
  );
}

function ShareButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg py-2.5 text-sm font-semibold border border-border hover:border-foreground/40 transition-colors"
    >
      {children}
    </button>
  );
}
