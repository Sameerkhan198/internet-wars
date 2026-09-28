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
import StatusPill from "./StatusPill";
import TrackPageView from "./TrackPageView";
import { track } from "@/lib/analytics";
import { useCampaignPolling } from "@/hooks/useCampaignPolling";
import { formatINRCompact } from "@/lib/money";
import { sideVisual } from "@/lib/sides";
import type { CSSProperties } from "react";
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
  const [failedPolls, setFailedPolls] = useState(0);

  const openFor = useCallback(
    (team: TeamDTO) => {
      track("side_selected", { side: team.id === teamA.id ? "a" : "b" }, campaign.slug);
      setActiveTeam(team);
    },
    [teamA.id, campaign.slug]
  );

  const onFeedHealth = useCallback((ok: boolean) => setFailedPolls((n) => (ok ? 0 : n + 1)), []);

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

  useCampaignPolling(campaign.slug, POLL_INTERVAL_MS, onUpdate, onActivity, onFeedHealth);
  // Two misses in a row (~8s): say so, and label the figures as last-verified.
  const feedDown = failedPolls >= 2;

  const isLive = campaign.status === "LIVE";
  const va = sideVisual(teamA.accentTheme, "a");
  const vb = sideVisual(teamB.accentTheme, "b");
  // Every side-coloured element below reads these, so a campaign's themes
  // (admin-configurable per team) restyle the whole terminal in one place.
  const sideVars = {
    "--team-a": va.color,
    "--team-a-glow": va.glow,
    "--team-a-dim": va.dim,
    "--team-b": vb.color,
    "--team-b-glow": vb.glow,
    "--team-b-dim": vb.dim,
  } as CSSProperties;

  return (
    <main className="flex-1" style={sideVars}>
      <TrackPageView page="battle" campaignSlug={campaign.slug} />
      <TickerTape teamA={teamA} teamB={teamB} score={score} momentum={momentum} />
      {feedDown && (
        <div role="status" className="border-b border-signal/30 bg-signal/10 px-4 py-2 text-center font-mono text-xs text-signal">
          Live feed interrupted — showing the last verified figures
          {lastTick ? ` from ${lastTick.toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })} IST` : ""}. Reconnecting…
        </div>
      )}

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
                <span className="text-team-a">{teamA.name}</span>
                <span className="text-muted font-normal mx-2 sm:mx-3">/</span>
                <span className="text-team-b">{teamB.name}</span>
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
            center={<Countdown startAt={campaign.startAt} endAt={campaign.endAt} status={campaign.status} />}
            onBack={openFor}
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
          <MobileCta team={teamA} slot="a" onClick={() => openFor(teamA)} />
          <MobileCta team={teamB} slot="b" onClick={() => openFor(teamB)} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label !text-[10px]">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function MobileCta({ team, slot, onClick }: { team: TeamDTO; slot: "a" | "b"; onClick: () => void }) {
  const color = slot === "a" ? "var(--team-a)" : "var(--team-b)";
  return (
    <button
      onClick={onClick}
      className="min-h-11 rounded font-mono text-sm font-bold uppercase tracking-wider text-black active:scale-[0.98] transition-transform"
      style={{ background: color }}
    >
      {slot === "a" ? "▲" : "▼"} Back {team.shortName}
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
  const winnerSlot = winner?.id === teamA.id ? "a" : winner ? "b" : null;
  const wv = winner && winnerSlot ? sideVisual(winner.accentTheme, winnerSlot) : null;
  return (
    <div className="panel mt-4">
      <div className="panel-header">
        <span className="text-foreground">Final result</span>
        <span>Internet War #001</span>
      </div>
      <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
        {wv && winner && <Mascot icon={wv.icon} color={wv.color} label={winner.shortName} className="h-24 w-24 shrink-0" />}
        <div className="flex-1 text-center sm:text-left">
          <div className="label mb-1">Result</div>
          <div
            className="text-2xl sm:text-3xl font-bold mb-4"
            style={{ color: wv?.color }}
          >
            {winner ? `${winner.name} took #1` : "It's a tie"}
          </div>
          <div className="grid grid-cols-2 gap-6 max-w-md font-mono text-sm">
            <div>
              <div className="label text-team-a">{teamA.shortName}</div>
              <div className="text-lg font-semibold tabular-nums">{formatINRCompact(score.teamA.total)}</div>
              <div className="text-xs text-muted">{score.teamA.supporterCount.toLocaleString("en-IN")} supporters</div>
            </div>
            <div>
              <div className="label text-team-b">{teamB.shortName}</div>
              <div className="text-lg font-semibold tabular-nums">{formatINRCompact(score.teamB.total)}</div>
              <div className="text-xs text-muted">{score.teamB.supporterCount.toLocaleString("en-IN")} supporters</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
