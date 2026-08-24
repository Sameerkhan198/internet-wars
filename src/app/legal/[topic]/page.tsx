import { notFound } from "next/navigation";

const PAGES: Record<string, { title: string; body: string[] }> = {
  rules: {
    title: "Battle Rules",
    body: [
      "Internet Wars runs time-boxed community competitions (\"battles\"). Each battle has two sides; supporters make voluntary contributions to the side they identify with.",
      "Only contributions that are successfully verified by the payment provider count toward the public scoreboard. Pending, failed, refunded and charged-back contributions never affect team totals.",
      "The side with the higher total of verified qualifying support at the end of the battle window is shown as the leader. This reflects community support only — it is not a prize, payout, or financial outcome.",
      "A battle's end time is controlled by the platform, not by any individual user's device clock. Once a battle ends, its scoreboard is frozen and a final result is published.",
      "The platform reserves the right to review, flag, or exclude contributions that show signs of fraud, abuse, or payment reversal from qualifying totals, following an internal review process.",
    ],
  },
  terms: {
    title: "Terms of Use",
    body: [
      "By using Internet Wars, you agree to participate in good faith and to provide accurate information where requested.",
      "Contributions are voluntary support for a campaign side. They are not investments, deposits, securities, bets, or wagers, and do not entitle you to any financial return, dividend, or payout.",
      "The platform may suspend or restrict accounts that violate these terms, attempt to manipulate scores, or engage in fraudulent payment activity.",
      "These terms are a placeholder for the MVP and must be replaced with counsel-reviewed terms before real-money contributions are enabled.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      "We collect the minimum information needed to operate a campaign: a display name you choose (or anonymous participation), contribution amounts, and payment metadata required for reconciliation.",
      "We never display your email, phone number, payment identifiers, UPI ID, or bank details publicly. Leaderboards and activity feeds only show your chosen display name or \"Anonymous Supporter\".",
      "Payment credentials (card numbers, CVV, UPI PIN, banking passwords) are never collected or stored by this platform.",
      "This policy is a placeholder for the MVP and must be replaced with a counsel-reviewed privacy policy compliant with applicable Indian data protection law before production launch.",
    ],
  },
  refunds: {
    title: "Refund Policy",
    body: [
      "Refund eligibility, timelines and process will be defined per campaign and are configurable by platform administrators.",
      "A contribution that is refunded or charged back is removed from qualifying totals; historical scoreboard snapshots are preserved for accounting integrity but current totals always reflect only currently-qualifying contributions.",
      "This policy is a placeholder for the MVP and must be finalized alongside the selected payment provider and applicable consumer protection requirements before real-money contributions are enabled.",
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    body: [
      "Internet Wars is a community competition platform. Contributions are voluntary support for a selected campaign side and are not investments or deposits.",
      "Participation does not provide ownership, financial returns or guaranteed rewards. Campaign rules, payment eligibility, refunds and participation requirements apply.",
      "The platform does not provide investment, trading or financial advice, and does not make any claims about the future performance of Indian stocks, forex, or any other market.",
      "This disclaimer does not substitute for professional legal, tax, or compliance review, which is required before real-money transactions are enabled on this platform.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      "For support, questions, or to report a concern about this platform, please reach out through the contact channel configured by the operator.",
      "This is placeholder contact information for the MVP.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((topic) => ({ topic }));
}

export default async function LegalPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const page = PAGES[topic];
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-black tracking-tight mb-8">{page.title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        {page.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </main>
  );
}
