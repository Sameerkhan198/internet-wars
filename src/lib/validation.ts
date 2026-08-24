import { z } from "zod";

export const contributeSchema = z.object({
  campaignSlug: z.string().min(1).max(100),
  teamSlug: z.string().min(1).max(100),
  amount: z
    .number()
    .int()
    .positive()
    .max(10_000_000_00, "Amount exceeds the maximum allowed contribution"),
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[a-zA-Z0-9_ ]+$/, "Username can only contain letters, numbers, underscores and spaces"),
  isAnonymous: z.boolean().default(false),
});

export type ContributeInput = z.infer<typeof contributeSchema>;

export function sanitizeDisplayName(name: string): string {
  return name.trim().slice(0, 30).replace(/[<>]/g, "");
}
