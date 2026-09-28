import Link from "next/link";
import { requireAdminPage } from "@/server/adminAuth";
import CampaignForm from "@/components/admin/CampaignForm";

export const metadata = { title: "New battle — Admin" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  await requireAdminPage();

  // Neutral defaults: tomorrow 18:00 IST for 7 days. Sides are blank —
  // nothing here pre-fills a real rivalry.
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(12, 30, 0, 0); // 18:00 IST
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  return (
    <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-10">
      <Link href="/admin" className="label hover:text-foreground">
        ← Admin
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 mb-1">New battle</h1>
      <p className="text-sm text-muted mb-8">Saved as a draft. Nothing is public until you schedule or start it.</p>
      <CampaignForm
        mode="create"
        initial={{
          title: "",
          description: "",
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          minimumRupees: 10,
          maximumRupees: 100000,
          sideA: { name: "", shortName: "", theme: "bull" },
          sideB: { name: "", shortName: "", theme: "bear" },
        }}
      />
    </main>
  );
}
