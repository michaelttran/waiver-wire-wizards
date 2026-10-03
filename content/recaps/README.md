# Weekly recaps

One file per week, named `week-NN.md` (for example `week-04.md`). The first line is the
recap's title as a `#` heading. Everything after it is the recap body, in Markdown, and
shows on `/challenges` under the challenge schedule, newest week first.

`standings.json` holds the numbers for the table on `/standings`, one row per team keyed
by Sleeper user id. The page shows each team's current name from the database (synced
from Sleeper daily) and only falls back to the `name` here for a team it can't match.
`playoffOdds` is a percent, and anything under 1 shows as "<1%".

`standings.md` is the commentary under that table (luckiest team, unluckiest team, and so
on). Both standings files are rewritten every week.
