import { prisma } from "@/lib/prisma";

/**
 * Simple fixed-window rate limiter backed by the database, so it works
 * correctly across serverless instances without needing Redis for the MVP.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { bucketKey: key } });

  if (!bucket || now.getTime() - bucket.windowStart.getTime() > windowMs) {
    await prisma.rateLimitBucket.upsert({
      where: { bucketKey: key },
      create: { bucketKey: key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await prisma.rateLimitBucket.update({
    where: { bucketKey: key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true, remaining: limit - bucket.count - 1 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function hashIp(ip: string): string {
  // Not for security (no salt/secret) — just enough to bucket abusive IPs
  // without storing them in plaintext in the ledger.
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash << 5) - hash + ip.charCodeAt(i);
    hash |= 0;
  }
  return `ip_${hash}`;
}
