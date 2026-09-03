import { syncSleeperLeague } from "../lib/sleeper";

async function main() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!leagueId) {
    throw new Error("SLEEPER_LEAGUE_ID is not set");
  }

  const result = await syncSleeperLeague(leagueId);
  console.log(`Synced ${result.teamCount} teams and ${result.pickCount} draft picks from Sleeper.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
