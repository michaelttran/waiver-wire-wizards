import SectionCard from "@/components/SectionCard";
import ScoreTable from "@/components/ScoreTable";
import {
  ROSTER_SLOTS,
  PASSING,
  RUSHING,
  RECEIVING,
  KICKING,
  TEAM_DEFENSE,
  SPECIAL_TEAMS_DEFENSE,
  SPECIAL_TEAMS_PLAYER,
  MISC,
} from "@/lib/rulesData";

export const metadata = {
  title: "Rules & Scoring — Waiver Wire Wizards",
};

export default function RulesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Rules &amp; Scoring
        </h1>
        <p className="text-ink/60 text-sm">
          Full point-value breakdown by category. An em dash (—) means that stat is not scored.
        </p>
      </div>

      <SectionCard title="Team Composition">
        <table className="wwz-table">
          <thead>
            <tr>
              <th>Roster Slot</th>
            </tr>
          </thead>
          <tbody>
            {ROSTER_SLOTS.map((slot) => (
              <tr key={slot}>
                <td>{slot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="Passing">
          <ScoreTable rows={PASSING} />
        </SectionCard>
        <SectionCard title="Rushing">
          <ScoreTable rows={RUSHING} />
        </SectionCard>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="Receiving">
          <ScoreTable rows={RECEIVING} />
        </SectionCard>
        <SectionCard title="Kicking">
          <ScoreTable rows={KICKING} />
        </SectionCard>
      </div>

      <SectionCard title="Team Defense">
        <ScoreTable rows={TEAM_DEFENSE} />
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="Special Teams (Defense)">
          <ScoreTable rows={SPECIAL_TEAMS_DEFENSE} />
        </SectionCard>
        <SectionCard title="Special Teams Player">
          <ScoreTable rows={SPECIAL_TEAMS_PLAYER} />
        </SectionCard>
      </div>

      <SectionCard title="Miscellaneous">
        <ScoreTable rows={MISC} />
      </SectionCard>
    </div>
  );
}
