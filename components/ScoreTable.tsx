import { ScoreRow } from "@/lib/rulesData";

export default function ScoreTable({ rows }: { rows: ScoreRow[] }) {
  return (
    <table className="wwz-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.category}>
            <td>{row.category}</td>
            <td>{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
