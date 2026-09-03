import SectionCard from "@/components/SectionCard";
import { PUNISHMENTS } from "@/lib/punishmentsData";

export const metadata = {
  title: "Punishments — Waiver Wire Wizards",
};

export default function PunishmentsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Punishments
        </h1>
        <p className="text-ink/60 text-sm">
          The proposed slate of punishments for whoever finishes last of the toilet bowl.
        </p>
      </div>

      <SectionCard title="Rules">
        <ul className="p-4 space-y-2 text-sm list-disc list-inside">
          <li>
            The loser is the <span className="font-600 text-purple">last place toilet bowl</span>{" "}
            finisher.
          </li>
          <li>
            They must complete their punishment in full before the upcoming year&rsquo;s draft.
          </li>
          <li>
            If the punishment isn&rsquo;t completed, they forfeit their{" "}
            <span className="font-600">first pick in next year&rsquo;s draft</span>.
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="The Wheel">
        <p className="p-4 text-sm">
          The loser will spin the wheel at the end of the season, and whatever it lands on will
          be their punishment.
        </p>
      </SectionCard>

      <SectionCard title="Proposed Punishments">
        <table className="wwz-table">
          <thead>
            <tr>
              <th>Proposed By</th>
              <th>Punishment</th>
            </tr>
          </thead>
          <tbody>
            {PUNISHMENTS.map((p) => (
              <tr key={p.proposedBy}>
                <td className="font-600 whitespace-nowrap align-top">{p.proposedBy}</td>
                <td>{p.punishment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
