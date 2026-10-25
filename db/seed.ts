import { roster } from "@contracts/catalog";
import { getDb } from "../api/queries/connection";
import { students } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding class roster...");
  await Promise.all(roster.map(([name, studentNo], index) => {
    const record = { name, studentNo, rosterOrder: index + 1 };
    return db.insert(students).values(record).onDuplicateKeyUpdate({ set: record });
  }));
  console.log(`Done: ${roster.length} students.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
