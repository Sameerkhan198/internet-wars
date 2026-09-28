"use client";

import { useCallback, useState } from "react";
import Scoreboard from "./Scoreboard";
import Countdown from "./Countdown";
import MomentumSection from "./MomentumSection";
import ActivityFeed from "./ActivityFeed";
import LeaderboardPreview from "./LeaderboardPreview";
import ContributionModal from "./ContributionModal";
import TickerTape from "./TickerTape";
import BattleChart from "./BattleChart";
import Mascot from "./Mascot";
import { useCampaignPolling } from "@/hooks/useCampaignPolling";
import { formatINRCompact } from "@/lib/money";
import type {
  ActivityEventDTO,
  CampaignDTO,
  CampaignScoreDTO,
  LeaderboardRow,
  ScorePointDTO,
  TeamDTO,
} from "@/lib/types";

const POLL_INTERVAL_MS = 4000;

export default function BattleView({
  campaign,
  teamA,
  teamB,
  initialScore,
  initialMomentum,
  initialLeaderboard,
  initialSeries,
}: {
  campaign: CampaignDTO;
  teamA: TeamDTO;
  teamB: TeamDTO;
  initialScore: CampaignScoreDTO;
  initialMomentum: { teamA10m: number; teamB10m: number };
  initialLeaderboard: { teamA: LeaderboardRow[]; teamB: LeaderboardRow[] };
  initialSeries: ScorePointDTO[];
}) {
  const [score, setScore] = useState(initialScore);
  const [momentum, setMomentum] = useState(initialMomentum);
  const [series, setSeries] = useState(initialSeries);
  const [lastTick, setLastTick] = useState<Date | null>(null);
  const [events, setEvents] = useState<ActivityEventDTO[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamDTO | null>(null);

  const onUpdate = useCallback(
    (data: { score: CampaignScoreDTO; momentum: { teamA10m: number; teamB10m: number } }) => {
      setScore(data.score);
      setMomentum(data.momentum);
      setLastTick(new Date());
      // Extend the chart with the live total whenever it moves.
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.a === data.score.teamA.total && last.b === data.score.teamB.total) return prev;
        return [...prev, { t: new Date().toISOString(), a: data.score.teamA.total, b: data.score.teamB.total }];
      });
    },
    []
  );

  const onActivity = useCallback((newEvents: ActivityEventDTO[]) => {
    setEvents((prev) => [...newEvents, ...prev].slice(0, 30));
  }, []);

  useCampaignPolling(campaign.slug, POLL_INTERVAL_MS, onUpdate, onActivity);

  const isLive = campaign.status === "LIVE";

  return (
    <main className="flex-1">
      <TickerTape teamA={teamA} teamB={teamB} score={score} momentum={momentum} />

      <div className="bg-terminal">
        <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 sm:pt-12 pb-6">
          {/* instrument header */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={campaign.status} />
                <span className="label">Internet War #001</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
                <span className="text-bull">{teamA.name}</span>
                <span className="text-muted font-normal mx-2 sm:mx-3">/</span>
                <span className="text-bear">{teamB.name}</span>
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Pick your side. Support your community. Move the scoreboard.
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 font-mono text-xs">
              <Stat label="Total support" value={formatINRCompact(score.combinedTotal)} />
              <Stat
                label="Supporters"
                value={(score.teamA.supporterCount + score.teamB.supporterCount).toLocaleString("en-IN")}
              />
              <Stat
                label="Last tick"
                value={
                  lastTick
                    ? lastTick.toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })
                    : "—"
                }
              />
            </dl>
          </div>

          <Scoreboard
            teamA={teamA}
            teamB={teamB}
            score={score}
            center={<Countdown endAt={campaign.endAt} status={campaign.status} />}
            onBack={setActiveTeam}
            canBack={isLive}
          />

          {!isLive && campaign.status === "ENDED" && (
            <FinalResult campaign={campaign} teamA={teamA} teamB={teamB} score={score} />
          )}
        </section>
      </div>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-4">
        <BattleChart series={series} teamA={teamA} teamB={teamB} />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 sm:pb-12 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MomentumSection teamA={teamA} teamB={teamB} momentum={momentum} />
        <LeaderboardPreview teamA={teamA} teamB={teamB} leaderboard={initialLeaderboard} />
        <ActivityFeed events={events} />
      </section>

      {isLive && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-2 gap-2 p-3 bg-background/95 backdrop-blur border-t border-border">
          <MobileCta team={teamA} side="bull" onClick={() => setActiveTeam(teamA)} />
          <MobileCta team={teamB} side="bear" onClick={() => setActiveTeam(teamB)} />
        </div>
      )}

      {activeTeam && (
        <ContributionModal
          campaign={campaign}
          team={activeTeam}
          score={score}
          onClose={() => setActiveTeam(null)}
        />
      )}
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { text: string; color: string }> = {
    LIVE: { text: "Live", color: "var(--bear)" },
    PAUSED: { text: "Paused", color: "var(--signal)" },
    ENDED: { text: "Closed", color: "var(--muted)" },
  };
  const s = map[status] ?? { text: status, color: "var(--muted)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest"
      style={{ color: s.color, borderColor: s.color }}
    >
      {status === "LIVE" && <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />}
      {s.text}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label !text-[10px]">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function MobileCta({ team, side, onClick }: { team: TeamDTO; side: "bull" | "bear"; onClick: () => void }) {
  const color = side === "bull" ? "var(--bull)" : "var(--bear)";
  return (
    <button
      onClick={onClick}
      className="min-h-11 rounded font-mono text-sm font-bold uppercase tracking-wider text-black active:scale-[0.98] transition-transform"
      style={{ background: color }}
    >
      {side === "bull" ? "▲" : "▼"} Back {team.shortName}
    </button>
  );
}

function FinalResult({
  campaign,
  teamA,
  teamB,
  score,
}: {
  campaign: CampaignDTO;
  teamA: TeamDTO;
  teamB: TeamDTO;
  score: CampaignScoreDTO;
}) {
  const winner = campaign.winnerTeamId === teamA.id ? teamA : campaign.winnerTeamId === teamB.id ? teamB : null;
  const winnerSide = winner?.id === teamA.id ? "bull" : winner ? "bear" : null;
  return (
    <div className="panel mt-4">
      <div className="panel-header">
        <span className="text-foreground">Final result</span>
        <span>Internet War #001</span>
      </div>
      <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
        {winnerSide && <Mascot side={winnerSide} className="h-24 w-24 shrink-0" />}
        <div className="flex-1 text-center sm:text-left">
          <div className="label mb-1">Result</div>
          <div
            className="text-2xl sm:text-3xl font-bold mb-4"
            style={{ color: winnerSide === "bull" ? "var(--bull)" : winnerSide === "bear" ? "var(--bear)" : undefined }}
          >
            {winner ? `${winner.name} took #1` : "It's a tie"}
          </div>
          <div className="grid grid-cols-2 gap-6 max-w-md font-mono text-sm">
            <div>
              <div className="label text-bull">{teamA.shortName}</div>
              <div className="text-lg font-semibold tabular-nums">{formatINRCompact(score.teamA.total)}</div>
              <div className="text-xs text-muted">{score.teamA.supporterCount.toLocaleString("en-IN")} supporters</div>
            </div>
            <div>
              <div className="label text-bear">{teamB.shortName}</div>
              <div className="text-lg font-semibold tabular-nums">{formatINRCompact(score.teamB.total)}</div>
              <div className="text-xs text-muted">{score.teamB.supporterCount.toLocaleString("en-IN")} supporters</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
