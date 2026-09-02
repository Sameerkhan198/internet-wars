"use client";

import { useCallback, useState } from "react";
import Scoreboard from "./Scoreboard";
import Countdown from "./Countdown";
import MomentumSection from "./MomentumSection";
import ActivityFeed from "./ActivityFeed";
import LeaderboardPreview from "./LeaderboardPreview";
import ContributionModal from "./ContributionModal";
import { useCampaignPolling } from "@/hooks/useCampaignPolling";
import { formatINRCompact } from "@/lib/money";
import type {
  ActivityEventDTO,
  CampaignDTO,
  CampaignScoreDTO,
  LeaderboardRow,
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
}: {
  campaign: CampaignDTO;
  teamA: TeamDTO;
  teamB: TeamDTO;
  initialScore: CampaignScoreDTO;
  initialMomentum: { teamA10m: number; teamB10m: number };
  initialLeaderboard: { teamA: LeaderboardRow[]; teamB: LeaderboardRow[] };
}) {
  const [score, setScore] = useState(initialScore);
  const [momentum, setMomentum] = useState(initialMomentum);
  const [events, setEvents] = useState<ActivityEventDTO[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamDTO | null>(null);

  const onUpdate = useCallback((data: { score: CampaignScoreDTO; momentum: { teamA10m: number; teamB10m: number } }) => {
    setScore(data.score);
    setMomentum(data.momentum);
  }, []);

  const onActivity = useCallback((newEvents: ActivityEventDTO[]) => {
    setEvents((prev) => [...newEvents, ...prev].slice(0, 30));
  }, []);

  useCampaignPolling(campaign.slug, POLL_INTERVAL_MS, onUpdate, onActivity);

  const isLive = campaign.status === "LIVE";

  return (
    <main className="flex-1 bg-grid">
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 sm:pt-16 pb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-400">
              <span className="live-dot h-2 w-2 rounded-full bg-red-500" /> Live
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight">INTERNET WARS</h1>
        <p className="mt-2 text-base sm:text-xl font-bold text-muted">
          Indian Stock Market 🆚 Forex Market
        </p>
        <p className="mt-4 text-lg sm:text-2xl font-semibold">Which community will take #1?</p>
        <p className="mt-1 text-sm sm:text-base text-muted">Pick your side. Support your community. Move the scoreboard.</p>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <Scoreboard teamA={teamA} teamB={teamB} score={score} />

        <div className="mt-8">
          <Countdown endAt={campaign.endAt} status={campaign.status} />
        </div>

        {isLive && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 sm:max-w-md sm:mx-auto pb-24 sm:pb-0">
            <CtaButton team={teamA} accentVar="--team-a" onClick={() => setActiveTeam(teamA)} />
            <CtaButton team={teamB} accentVar="--team-b" onClick={() => setActiveTeam(teamB)} />
          </div>
        )}
        <p className="text-center text-xs text-muted mt-3 mb-4">Choose your side and support the community.</p>

        {!isLive && campaign.status === "ENDED" && (
          <FinalResult campaign={campaign} teamA={teamA} teamB={teamB} score={score} />
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-14">
        <MomentumSection teamA={teamA} teamB={teamB} momentum={momentum} />
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-14">
        <LeaderboardPreview teamA={teamA} teamB={teamB} leaderboard={initialLeaderboard} />
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-14 pb-16">
        <ActivityFeed events={events} />
      </section>

      {isLive && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-2 gap-2 p-3 bg-background/95 backdrop-blur border-t border-border">
          <CtaButton team={teamA} accentVar="--team-a" onClick={() => setActiveTeam(teamA)} compact />
          <CtaButton team={teamB} accentVar="--team-b" onClick={() => setActiveTeam(teamB)} compact />
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

function CtaButton({
  team,
  accentVar,
  onClick,
  compact,
}: {
  team: TeamDTO;
  accentVar: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl font-black uppercase tracking-wide transition-transform active:scale-95 ${
        compact ? "py-3 text-sm" : "py-4 text-base sm:text-lg"
      }`}
      style={{ background: `var(${accentVar})`, color: "#08090c" }}
    >
      Back {team.shortName}
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
  return (
    <div className="mt-10 rounded-2xl border border-border p-8 text-center bg-background-elevated/60">
      <div className="text-sm text-muted uppercase tracking-widest mb-2">🏆 Internet War #001 — Final Result</div>
      {winner ? (
        <div className="text-2xl sm:text-3xl font-black mb-6">{winner.name.toUpperCase()} WON</div>
      ) : (
        <div className="text-2xl sm:text-3xl font-black mb-6">IT&apos;S A TIE</div>
      )}
      <div className="grid grid-cols-2 gap-6 max-w-md mx-auto text-left">
        <div>
          <div className="text-xs text-muted">{teamA.shortName}</div>
          <div className="numeric text-xl font-bold">{formatINRCompact(score.teamA.total)}</div>
          <div className="text-xs text-muted">{score.teamA.supporterCount.toLocaleString("en-IN")} supporters</div>
        </div>
        <div>
          <div className="text-xs text-muted">{teamB.shortName}</div>
          <div className="numeric text-xl font-bold">{formatINRCompact(score.teamB.total)}</div>
          <div className="text-xs text-muted">{score.teamB.supporterCount.toLocaleString("en-IN")} supporters</div>
        </div>
      </div>
    </div>
  );
}
