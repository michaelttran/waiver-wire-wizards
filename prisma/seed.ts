import { prisma } from "../lib/prisma";

const CHALLENGES: { week: number; title: string; criteria: string }[] = [
  { week: 1, title: "Highest Team Score", criteria: "Highest total points" },
  { week: 2, title: "Biggest Blowout", criteria: "Largest margin of victory" },
  { week: 3, title: "Closest Win", criteria: "Smallest winning margin" },
  { week: 4, title: "QB King", criteria: "Highest-scoring QB in a starting lineup" },
  { week: 5, title: "Ground & Pound", criteria: "Highest combined RB1 + RB2 score" },
  { week: 6, title: "Air Raid", criteria: "Highest combined WR1 + WR2 score" },
  { week: 7, title: "Flex Appeal", criteria: "Highest-scoring FLEX player" },
  { week: 8, title: "Tight End Tuesday", criteria: "Highest-scoring TE" },
  { week: 9, title: "Kicker's Revenge", criteria: "Highest-scoring kicker" },
  { week: 10, title: "Upset of the Week", criteria: "Lowest projected team that wins" },
  { week: 11, title: "Bench Boss", criteria: "Highest bench points (excluding injured/bye players)" },
  { week: 12, title: "Boom or Bust", criteria: "Single highest-scoring player in a starting lineup" },
  { week: 13, title: "Perfect Lineup", criteria: "Fewest points left on the bench (best lineup decisions)" },
  { week: 14, title: "Total Domination", criteria: "Highest points from both starting lineup and bench" },
];

// Real league teams and draft order/results, captured from the commissioner's
// draft settings screen and the post-draft results board.
const TEAMS: { name: string; ownerName: string; draftPosition: number }[] = [
  { name: "Team vickdabrick", ownerName: "vickdabrick", draftPosition: 1 },
  { name: "BIJAN MUSTARD", ownerName: "schwig", draftPosition: 2 },
  { name: "The Strib Club", ownerName: "Hos3", draftPosition: 3 },
  { name: "Team dleung", ownerName: "dleung", draftPosition: 4 },
  { name: "Melatonin", ownerName: "carmela", draftPosition: 5 },
  { name: "Team annguy", ownerName: "annguy", draftPosition: 6 },
  { name: "Team hatetoseemecoming", ownerName: "juuprz", draftPosition: 7 },
  { name: "Team anewbie", ownerName: "anewbie", draftPosition: 8 },
  { name: "Team robobin", ownerName: "robobin", draftPosition: 9 },
  { name: "Jed's Criminal Tools", ownerName: "pranjal94", draftPosition: 10 },
  { name: "By the Grace of Godwin", ownerName: "jzpenney", draftPosition: 11 },
  { name: "Susanna's Sunshine", ownerName: "hrtranica", draftPosition: 12 },
];

type PickEntry = { player: string; pos: string; team: string; note?: string };

// Each row is one round; entries are in the same left-to-right column order
// as TEAMS (draft position 1-12), matching how the results board displays
// them. Pick number within the round and overall pick are derived below
// using standard snake-draft order.
const ROUNDS: PickEntry[][] = [
  [
    { player: "Jahmyr Gibbs", pos: "RB", team: "DET" },
    { player: "Bijan Robinson", pos: "RB", team: "ATL" },
    { player: "Jonathan Taylor", pos: "RB", team: "IND" },
    { player: "Christian McCaffrey", pos: "RB", team: "SF" },
    { player: "James Cook", pos: "RB", team: "BUF" },
    { player: "De'Von Achane", pos: "RB", team: "MIA" },
    { player: "Ja'Marr Chase", pos: "WR", team: "CIN" },
    { player: "Derrick Henry", pos: "RB", team: "BAL" },
    { player: "Puka Nacua", pos: "RB", team: "LAR" },
    { player: "Amon-Ra St. Brown", pos: "WR", team: "DET" },
    { player: "Jaxon Smith-Njigba", pos: "WR", team: "SEA" },
    { player: "Saquon Barkley", pos: "RB", team: "PHI" },
  ],
  [
    { player: "Brock Bowers", pos: "TE", team: "LV" },
    { player: "Josh Allen", pos: "QB", team: "BUF" },
    { player: "Malik Nabers", pos: "WR", team: "NYG" },
    { player: "Kyren Williams", pos: "RB", team: "LAR" },
    { player: "George Pickens", pos: "WR", team: "DAL" },
    { player: "A.J. Brown", pos: "WR", team: "NE" },
    { player: "Justin Jefferson", pos: "WR", team: "MIN" },
    { player: "Nico Collins", pos: "WR", team: "HOU" },
    { player: "CeeDee Lamb", pos: "WR", team: "DAL" },
    { player: "Kenneth Walker", pos: "RB", team: "SEA" },
    { player: "Omarion Hampton", pos: "RB", team: "LAC" },
    { player: "Chase Brown", pos: "RB", team: "CIN" },
  ],
  [
    { player: "Javonte Williams", pos: "RB", team: "DAL" },
    { player: "Trey McBride", pos: "TE", team: "ARI" },
    { player: "Ashton Jeanty", pos: "RB", team: "LV", note: "Steal" },
    { player: "Drake London", pos: "WR", team: "ATL" },
    { player: "Travis Etienne", pos: "RB", team: "JAX" },
    { player: "Zay Flowers", pos: "WR", team: "BAL" },
    { player: "Jeremiyah Love", pos: "RB", team: "ARI", note: "Steal" },
    { player: "Breece Hall", pos: "RB", team: "NYJ" },
    { player: "Chris Olave", pos: "WR", team: "NO" },
    { player: "DeVonta Smith", pos: "WR", team: "PHI" },
    { player: "Tetairoa McMillan", pos: "WR", team: "CAR" },
    { player: "D'Andre Swift", pos: "RB", team: "CHI" },
  ],
  [
    { player: "Emeka Egbuka", pos: "WR", team: "TB" },
    { player: "Garrett Wilson", pos: "WR", team: "NYJ" },
    { player: "DJ Moore", pos: "WR", team: "CHI" },
    { player: "Jadarian Price", pos: "RB", team: "SEA" },
    { player: "Tee Higgins", pos: "WR", team: "CIN" },
    { player: "David Montgomery", pos: "RB", team: "DET" },
    { player: "Rashee Rice", pos: "WR", team: "KC" },
    { player: "Terry McLaurin", pos: "WR", team: "WAS" },
    { player: "Cam Skattebo", pos: "RB", team: "NYG" },
    { player: "Luther Burden", pos: "WR", team: "CHI" },
    { player: "Jaylen Waddle", pos: "WR", team: "MIA" },
    { player: "Ladd McConkey", pos: "WR", team: "LAC" },
  ],
  [
    { player: "Lamar Jackson", pos: "QB", team: "BAL", note: "Steal" },
    { player: "Jameson Williams", pos: "WR", team: "DET" },
    { player: "Josh Jacobs", pos: "RB", team: "GB", note: "Steal" },
    { player: "Colston Loveland", pos: "TE", team: "CHI" },
    { player: "Harold Fannin", pos: "TE", team: "CLE", note: "Reach" },
    { player: "Drake Maye", pos: "QB", team: "NE" },
    { player: "Bucky Irving", pos: "RB", team: "TB" },
    { player: "Tyler Warren", pos: "TE", team: "IND" },
    { player: "Bhayshul Tuten", pos: "RB", team: "JAX" },
    { player: "Mike Evans", pos: "WR", team: "TB" },
    { player: "Quinshon Judkins", pos: "RB", team: "CLE" },
    { player: "Davante Adams", pos: "WR", team: "LAR" },
  ],
  [
    { player: "Michael Wilson", pos: "WR", team: "ARI" },
    { player: "Tony Pollard", pos: "RB", team: "TEN" },
    { player: "Chuba Hubbard", pos: "RB", team: "CAR" },
    { player: "Christian Watson", pos: "WR", team: "GB" },
    { player: "Jared Goff", pos: "QB", team: "DET" },
    { player: "Rome Odunze", pos: "WR", team: "CHI" },
    { player: "Jalen Hurts", pos: "QB", team: "PHI" },
    { player: "Joe Burrow", pos: "QB", team: "CIN" },
    { player: "TreVeyon Henderson", pos: "RB", team: "NE" },
    { player: "Rhamondre Stevenson", pos: "RB", team: "NE" },
    { player: "Jaylen Warren", pos: "RB", team: "PIT" },
    { player: "Parker Washington", pos: "WR", team: "JAX" },
  ],
  [
    { player: "MarShawn Lloyd", pos: "RB", team: "GB" },
    { player: "Brian Thomas", pos: "WR", team: "JAX", note: "Reach" },
    { player: "De'Zhaun Stribling", pos: "WR", team: "SF", note: "Reach" },
    { player: "Marvin Harrison", pos: "WR", team: "ARI" },
    { player: "Jordan Mason", pos: "RB", team: "MIN" },
    { player: "Carnell Tate", pos: "WR", team: "TEN" },
    { player: "Tucker Kraft", pos: "TE", team: "GB" },
    { player: "DK Metcalf", pos: "WR", team: "PIT" },
    { player: "Jonathon Brooks", pos: "RB", team: "CAR" },
    { player: "Sam LaPorta", pos: "TE", team: "DET" },
    { player: "Chris Godwin", pos: "WR", team: "TB" },
    { player: "RJ Harvey", pos: "RB", team: "DEN" },
  ],
  [
    { player: "Makai Lemon", pos: "WR", team: "PHI", note: "Reach" },
    { player: "Tyler Allgeier", pos: "RB", team: "ATL", note: "Reach" },
    { player: "Jacory Croskey-Merritt", pos: "RB", team: "WAS" },
    { player: "Quentin Johnston", pos: "WR", team: "LAC" },
    { player: "Chris Rodriguez", pos: "RB", team: "LAR", note: "Reach" },
    { player: "Blake Corum", pos: "RB", team: "LAR" },
    { player: "J.K. Dobbins", pos: "RB", team: "DEN" },
    { player: "Rams", pos: "DEF", team: "LAR" },
    { player: "Jayden Daniels", pos: "QB", team: "WAS", note: "Steal" },
    { player: "Michael Pittman", pos: "WR", team: "IND" },
    { player: "Rico Dowdle", pos: "RB", team: "PIT" },
    { player: "Kenny Gainwell", pos: "RB", team: "TB", note: "Reach" },
  ],
  [
    { player: "KC Concepcion", pos: "WR", team: "CLE", note: "Steal" },
    { player: "Zach Charbonnet", pos: "RB", team: "SEA" },
    { player: "Matthew Golden", pos: "WR", team: "GB" },
    { player: "Kyle Monangai", pos: "RB", team: "CHI" },
    { player: "Jordan Addison", pos: "WR", team: "MIN" },
    { player: "Texans", pos: "DEF", team: "HOU" },
    { player: "Aaron Jones", pos: "RB", team: "MIN" },
    { player: "Courtland Sutton", pos: "WR", team: "DEN" },
    { player: "Josh Downs", pos: "WR", team: "IND" },
    { player: "Stefon Diggs", pos: "WR", team: "WAS" },
    { player: "Caleb Williams", pos: "QB", team: "CHI", note: "Steal" },
    { player: "Justin Herbert", pos: "QB", team: "LAC" },
  ],
  [
    { player: "Tank Bigsby", pos: "RB", team: "PHI", note: "Reach" },
    { player: "Romeo Doubs", pos: "WR", team: "NE" },
    { player: "Woody Marks", pos: "RB", team: "HOU" },
    { player: "Trevor Lawrence", pos: "QB", team: "JAX", note: "Reach" },
    { player: "Jalen Coker", pos: "WR", team: "CAR" },
    { player: "Jordyn Tyson", pos: "WR", team: "NO" },
    { player: "Broncos", pos: "DEF", team: "DEN" },
    { player: "Jayden Reed", pos: "WR", team: "GB", note: "Steal" },
    { player: "George Kittle", pos: "TE", team: "SF", note: "Steal" },
    { player: "Rachaad White", pos: "RB", team: "TB" },
    { player: "Dalton Kincaid", pos: "TE", team: "BUF", note: "Reach" },
    { player: "Mike Washington", pos: "RB", team: "LV" },
  ],
  [
    { player: "Seahawks", pos: "DEF", team: "SEA" },
    { player: "Deebo Samuel", pos: "WR", team: "WAS" },
    { player: "Alec Pierce", pos: "WR", team: "IND" },
    { player: "Kaelon Black", pos: "RB", team: "SF", note: "Reach" },
    { player: "Brian Robinson", pos: "RB", team: "WAS" },
    { player: "Kyle Pitts", pos: "TE", team: "ATL", note: "Steal" },
    { player: "Xavier Worthy", pos: "WR", team: "KC" },
    { player: "Jonah Coleman", pos: "RB", team: "DEN", note: "Steal" },
    { player: "Dallas Goedert", pos: "TE", team: "PHI" },
    { player: "Keaton Mitchell", pos: "RB", team: "LAC", note: "Reach" },
    { player: "Tyjae Spears", pos: "RB", team: "TEN", note: "Reach" },
    { player: "Ja'Kobi Lane", pos: "WR", team: "BAL" },
  ],
  [
    { player: "Ka'imi Fairbairn", pos: "K", team: "HOU", note: "Reach" },
    { player: "Kayshon Boutte", pos: "WR", team: "NE" },
    { player: "Jaxson Dart", pos: "QB", team: "NYG" },
    { player: "Emmett Johnson", pos: "RB", team: "KC", note: "Steal" },
    { player: "Vikings", pos: "DEF", team: "MIN" },
    { player: "Tyrone Tracy", pos: "RB", team: "NYG" },
    { player: "Jason Myers", pos: "K", team: "SEA" },
    { player: "Cameron Dicker", pos: "K", team: "LAC" },
    { player: "Wan'Dale Robinson", pos: "WR", team: "TEN" },
    { player: "Brock Purdy", pos: "QB", team: "SF", note: "Steal" },
    { player: "Brandon Aubrey", pos: "K", team: "DAL" },
    { player: "Jalen Nailor", pos: "WR", team: "LV", note: "Reach" },
  ],
  [
    { player: "Isaiah Likely", pos: "TE", team: "BAL", note: "Steal" },
    { player: "Justice Hill", pos: "RB", team: "BAL" },
    { player: "Travis Kelce", pos: "TE", team: "KC", note: "Steal" },
    { player: "Rashid Shaheed", pos: "WR", team: "SEA" },
    { player: "Eddy Pineiro", pos: "K", team: "SF", note: "Reach" },
    { player: "Cam Little", pos: "K", team: "JAX" },
    { player: "Jakobi Meyers", pos: "WR", team: "JAX" },
    { player: "Alvin Kamara", pos: "RB", team: "NO", note: "Steal" },
    { player: "Denzel Boston", pos: "WR", team: "CLE" },
    { player: "Eagles", pos: "DEF", team: "PHI" },
    { player: "Ravens", pos: "DEF", team: "BAL" },
    { player: "Juwan Johnson", pos: "WR", team: "NO" },
  ],
  [
    { player: "Brenton Strange", pos: "TE", team: "JAX" },
    { player: "Khalil Shakir", pos: "WR", team: "BUF", note: "Steal" },
    { player: "Jake Bates", pos: "K", team: "DET", note: "Steal" },
    { player: "Steelers", pos: "DEF", team: "PIT" },
    { player: "Dylan Sampson", pos: "RB", team: "CLE" },
    { player: "Mark Andrews", pos: "TE", team: "BAL" },
    { player: "Kaytron Allen", pos: "RB", team: "WAS" },
    { player: "Jake Ferguson", pos: "TE", team: "DAL", note: "Steal" },
    { player: "Chargers", pos: "DEF", team: "LAC" },
    { player: "Trey Smack", pos: "K", team: "GB" },
    { player: "Malik Washington", pos: "WR", team: "MIA" },
    { player: "Jaguars", pos: "DEF", team: "JAX" },
  ],
  [
    { player: "Adonai Mitchell", pos: "WR", team: "NYJ" },
    { player: "Chris Boswell", pos: "K", team: "PIT" },
    { player: "Packers", pos: "DEF", team: "GB" },
    { player: "Harrison Mevis", pos: "K", team: "LAR" },
    { player: "Dak Prescott", pos: "QB", team: "DAL", note: "Steal" },
    { player: "Matthew Stafford", pos: "QB", team: "LAR", note: "Steal" },
    { player: "Chig Okonkwo", pos: "TE", team: "WAS" },
    { player: "Nicholas Singleton", pos: "RB", team: "PIT", note: "Steal" },
    { player: "Evan McPherson", pos: "K", team: "CIN", note: "Steal" },
    { player: "Hunter Henry", pos: "TE", team: "NE" },
    { player: "Kimani Vidal", pos: "RB", team: "LAC" },
    { player: "Bo Nix", pos: "QB", team: "DEN" },
  ],
];

async function main() {
  for (const c of CHALLENGES) {
    await prisma.weeklyChallenge.upsert({
      where: { week: c.week },
      update: { title: c.title, criteria: c.criteria },
      create: c,
    });
  }

  await prisma.team.deleteMany({ where: { ownerName: "TBD" } });

  const teamIdByOwner = new Map<string, string>();
  for (const t of TEAMS) {
    const existing = await prisma.team.findFirst({ where: { ownerName: t.ownerName } });
    const team = existing
      ? await prisma.team.update({
          where: { id: existing.id },
          data: { name: t.name, draftPosition: t.draftPosition },
        })
      : await prisma.team.create({
          data: { name: t.name, ownerName: t.ownerName, faabStarting: 100, draftPosition: t.draftPosition },
        });
    teamIdByOwner.set(t.ownerName, team.id);
  }

  await prisma.draftPick.deleteMany({});
  for (let roundIdx = 0; roundIdx < ROUNDS.length; roundIdx++) {
    const round = roundIdx + 1;
    const entries = ROUNDS[roundIdx];
    for (let col = 0; col < TEAMS.length; col++) {
      const draftPosition = col + 1;
      const pick = round % 2 === 1 ? draftPosition : TEAMS.length + 1 - draftPosition;
      const overall = (round - 1) * TEAMS.length + pick;
      const entry = entries[col];
      const teamId = teamIdByOwner.get(TEAMS[col].ownerName)!;

      await prisma.draftPick.create({
        data: {
          teamId,
          round,
          pick,
          overall,
          playerName: entry.player,
          playerPosition: entry.pos,
          nflTeam: entry.team,
          note: entry.note,
        },
      });
    }
  }

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
