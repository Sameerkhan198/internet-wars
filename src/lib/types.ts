export type TeamDTO = {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  accentTheme: string;
};

export type CampaignDTO = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  minimumContribution: number;
  maximumContribution: number;
  currency: string;
  winnerTeamId: string | null;
};

export type TeamScoreDTO = {
  teamId: string;
  total: number;
  supporterCount: number;
  percentage: number;
};

export type CampaignScoreDTO = {
  teamA: TeamScoreDTO;
  teamB: TeamScoreDTO;
  combinedTotal: number;
  leaderTeamId: string | null;
  differenceAmount: number;
};

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  amount: number;
};

export type ActivityEventDTO = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};
