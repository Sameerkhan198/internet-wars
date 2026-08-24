import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [
    { url: `${base}/`, changeFrequency: "always", priority: 1 },
    { url: `${base}/leaderboard`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/history`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/legal/rules`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/legal/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/legal/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
