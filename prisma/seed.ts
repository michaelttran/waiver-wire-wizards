import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

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

const PLACEHOLDER_TEAMS = [
  "Team 1",
  "Team 2",
  "Team 3",
  "Team 4",
  "Team 5",
  "Team 6",
  "Team 7",
  "Team 8",
  "Team 9",
  "Team 10",
];

async function main() {
  for (const c of CHALLENGES) {
    await prisma.weeklyChallenge.upsert({
      where: { week: c.week },
      update: { title: c.title, criteria: c.criteria },
      create: c,
    });
  }

  const existingTeams = await prisma.team.count();
  if (existingTeams === 0) {
    for (const name of PLACEHOLDER_TEAMS) {
      await prisma.team.create({
        data: { name, ownerName: "TBD", faabStarting: 100 },
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
