import { seedDemoData } from "../src/server/seedDemoData";
import { prisma } from "../src/lib/prisma";

// Thin CLI wrapper. The actual seed logic lives in src/server/seedDemoData.ts
// so the admin dashboard can run the same routine against a hosted database.
async function main() {
  console.log("Seeding Internet Wars demo data...");
  const result = await seedDemoData();
  for (const team of result.teams) {
    console.log(
      `${team.shortName}: ₹${(team.total / 100).toLocaleString("en-IN")} from ${team.supporters} supporters`
    );
  }
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
