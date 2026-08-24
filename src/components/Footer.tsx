import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/history", label: "Battle History" },
  { href: "/legal/rules", label: "Battle Rules" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refunds", label: "Refund Policy" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background-elevated/40 mt-16">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6">
        <div>
          <div className="text-lg font-black tracking-tight">INTERNET WARS</div>
          <div className="text-sm text-muted">Pick a side. Move the score.</div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted max-w-3xl leading-relaxed">
          Internet Wars is a community competition platform. Contributions are voluntary support for a
          selected campaign side and are not investments or deposits. Participation does not provide
          ownership, financial returns or guaranteed rewards. Campaign rules, payment eligibility, refunds
          and participation requirements apply. The platform does not provide investment, trading or
          financial advice.
        </p>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Internet Wars</p>
      </div>
    </footer>
  );
}
