import Link from "next/link";
import SectionCard from "@/components/SectionCard";

export default function HomePage() {
  return (
    <div>
      <section className="bg-ink text-cream border-b-4 border-gold">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <p className="text-gold tracking-[0.3em] text-xs sm:text-sm mb-4">
            &#10022; &#10022; &#10022;
          </p>
          <h1 className="font-display font-700 text-3xl sm:text-5xl text-gold-light mb-3">
            WAIVER WIRE WIZARDS
          </h1>
          <p className="text-cream/80 text-sm sm:text-base">
            Official League Hub &mdash; Scoring, Payouts, Weekly Challenges & Roster Rules
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="grid sm:grid-cols-3 gap-6">
          <SectionCard title="Buy-In">
            <table className="wwz-table">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>League Entry</td>
                  <td>$50</td>
                </tr>
                <tr>
                  <td>Playoff / Extra Entry</td>
                  <td>$14</td>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          <SectionCard title="Winners & Payouts">
            <table className="wwz-table">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Prize</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1st</td>
                  <td>$340 + Ring</td>
                </tr>
                <tr>
                  <td>2nd</td>
                  <td>$160</td>
                </tr>
                <tr>
                  <td>3rd</td>
                  <td>$50</td>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          <SectionCard title="FAAB Budget">
            <table className="wwz-table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Season FAAB Allowance</td>
                  <td>$100</td>
                </tr>
              </tbody>
            </table>
          </SectionCard>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: "/rules", label: "Rules & Scoring", desc: "Full point-value breakdown" },
            { href: "/challenges", label: "Weekly Challenges", desc: "See this week's winner" },
            { href: "/faab", label: "FAAB Tracker", desc: "Remaining budget by team" },
            { href: "/draft", label: "Draft Order", desc: "Draft positions and picks" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="wwz-card p-5 hover:border-gold transition-colors block"
            >
              <p className="font-display font-600 text-purple mb-1">{item.label}</p>
              <p className="text-sm text-ink/60">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
