import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Generates the demo campaign, its two teams, and a spread of contributions.
 *
 * Lives here (rather than only in prisma/seed.ts) so it can also be triggered
 * from the admin dashboard on a deployed instance, which is the only place the
 * production DATABASE_URL exists. Seeding a hosted database therefore never
 * requires anyone to copy a connection string out of the host.
 */

const STOCK_NAMES = [
  "NiftyKing", "BullRun_Rahul", "MarketWolf", "TraderX", "SensexSam", "DalalStreetDiva",
  "RupeeRider", "EquityExpert", "ChartMaster", "BullishBanerjee", "NiftyNinja", "StockSurfer",
  "GreenCandleGirl", "IndexIndra", "PortfolioPandit", "ValueVihaan", "BluechipBhai", "TrendTrader99",
  "SensexScout", "RallyRaj", "MarketMaven", "BSEBoss", "CapitalCrusader", "NiftyNerd",
  "StockSage", "BullMarketBala", "TickerTanya", "SwingSid", "LongTermLata", "DividendDev",
];

const FOREX_NAMES = [
  "PipPirate", "FXFalcon", "CandleChaser", "DollarDude", "YenYogi", "EuroExplorer",
  "ForexFiona", "PoundPunter", "TrendlineTara", "SwingKing_Sam", "CarryTradeCarlos", "LeverageLeo",
  "ScalperShreya", "MarginMaster", "SpreadSpecialist", "BreakoutBrij", "FXFalconess", "PipStackerPia",
  "GoldbugGita", "CurrencyCraze", "NightOwlTrader", "SessionSurfer", "TrendFollowerTia", "ChartPatternChet",
  "RiskManagedRohan", "LiquidityLakshmi", "FXFrontier", "SafeHavenSana", "MacroMani", "VolatilityVeer",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(): number {
  const buckets = [1000, 5000, 10000, 50000, 100000, 250000, 500000];
  const weights = [30, 25, 20, 12, 8, 3, 2];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < buckets.length; i++) {
    if (r < weights[i]) return buckets[i];
    r -= weights[i];
  }
  return buckets[0];
}

export type SeedResult = {
  campaignSlug: string;
  teams: { shortName: string; total: number; supporters: number }[];
};

export async function seedDemoData(): Promise<SeedResult> {
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.shareEvent.deleteMany();
  await prisma.team.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany();

  // Campaign and Team have a circular FK (campaign.teamAId -> team.id,
  // team.campaignId -> campaign.id), so create the campaign first with no
  // teams, then the teams, then patch the campaign with the real team ids.
  const draftCampaign = await prisma.campaign.create({
    data: {
      slug: "stocks-vs-forex",
      title: "Indian Stock Market vs Forex Market",
      description: "Which community will take #1? Pick your side and support it.",
      startAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      status: "LIVE",
      currency: "INR",
      minimumContribution: 1000,
      maximumContribution: 10_000_00,
      rules:
        "Internet War #001. Contributions are voluntary community support, not investments. Totals reflect verified successful contributions only. Minimum ₹10, maximum ₹1,00,000 per contribution.",
    },
  });

  const teamA = await prisma.team.create({
    data: {
      campaignId: draftCampaign.id,
      name: "Indian Stock Market",
      slug: "stocks",
      shortName: "STOCKS",
      description: "Nifty, Sensex, and everyone who trades or invests in Indian equities.",
      accentTheme: "emerald",
    },
  });
  const teamB = await prisma.team.create({
    data: {
      campaignId: draftCampaign.id,
      name: "Forex Market",
      slug: "forex",
      shortName: "FOREX",
      description: "Currency traders backing the global forex community.",
      accentTheme: "violet",
    },
  });

  const campaign = await prisma.campaign.update({
    where: { id: draftCampaign.id },
    data: { teamAId: teamA.id, teamBId: teamB.id },
  });

  // Spread contributions across the last 3 days for realistic momentum history.
  // Rows are built in memory and written with two createMany calls rather than
  // ~360 sequential inserts — against a hosted database the round trips alone
  // would otherwise risk the serverless function's time limit. Ids are
  // generated up front so activity events can reference their contribution
  // without reading the rows back.
  const totalContributions = 180;
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const contributionRows: {
    id: string;
    campaignId: string;
    teamId: string;
    displayName: string;
    isAnonymous: boolean;
    amount: number;
    currency: string;
    status: "SUCCESS" | "FAILED" | "PENDING";
    createdAt: Date;
    verifiedAt: Date | null;
  }[] = [];

  const activityRows: {
    campaignId: string;
    type: "CONTRIBUTION" | "CAMPAIGN_START";
    contributionId: string | null;
    message: string;
    createdAt: Date;
  }[] = [];

  for (let i = 0; i < totalContributions; i++) {
    const isStocks = Math.random() < 0.51;
    const team = isStocks ? teamA : teamB;
    const name = isStocks ? pick(STOCK_NAMES) : pick(FOREX_NAMES);
    const amount = randomAmount();
    const isAnonymous = Math.random() < 0.12;
    const createdAt = new Date(now - Math.random() * threeDaysMs);
    // Occasionally fail/pending, matching a realistic payment success rate,
    // but demo data still only counts SUCCESS toward the public scoreboard.
    const roll = Math.random();
    const status = roll < 0.92 ? "SUCCESS" : roll < 0.97 ? "FAILED" : "PENDING";
    const id = crypto.randomUUID();

    contributionRows.push({
      id,
      campaignId: campaign.id,
      teamId: team.id,
      displayName: isAnonymous ? "Anonymous Supporter" : name,
      isAnonymous,
      amount,
      currency: "INR",
      status,
      createdAt,
      verifiedAt: status === "SUCCESS" ? createdAt : null,
    });

    if (status === "SUCCESS") {
      activityRows.push({
        campaignId: campaign.id,
        type: "CONTRIBUTION",
        contributionId: id,
        message: `${isAnonymous ? "Someone" : name} backed ${team.shortName} +₹${(amount / 100).toLocaleString("en-IN")}`,
        createdAt,
      });
    }
  }

  activityRows.push({
    campaignId: campaign.id,
    type: "CAMPAIGN_START",
    contributionId: null,
    message: "Internet War #001 is LIVE — Indian Stock Market vs Forex Market!",
    createdAt: campaign.startAt,
  });

  await prisma.contribution.createMany({ data: contributionRows });
  await prisma.activityEvent.createMany({ data: activityRows });

  const successful = await prisma.contribution.groupBy({
    by: ["teamId"],
    where: { campaignId: campaign.id, status: "SUCCESS" },
    _sum: { amount: true },
    _count: { _all: true },
  });

  return {
    campaignSlug: campaign.slug,
    teams: successful.map((row) => ({
      shortName: row.teamId === teamA.id ? teamA.shortName : teamB.shortName,
      total: row._sum.amount ?? 0,
      supporters: row._count._all,
    })),
  };
}
