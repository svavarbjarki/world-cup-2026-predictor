// One-off backfill: give every User row that has no resume code one.
//
// Run it once, manually, after the add-resume-code migration:
//   npx tsx scripts/backfill-resume-codes.ts
// (The repo uses tsx for its TypeScript scripts, e.g. the Prisma seed. The
//  equivalent "npx ts-node scripts/backfill-resume-codes.ts" works too.)
//
// The generation logic is duplicated from src/lib/auth.ts on purpose: that module
// imports next/headers and only runs inside Next, so a standalone Node script
// cannot import it. Keep the alphabet and format in sync if either changes.

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Uppercase alphanumeric with the ambiguous characters removed (no 0, O, I, 1).
// Exactly 32 symbols, so a random byte taken modulo the length is unbiased.
const RESUME_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomResumeCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += RESUME_CODE_ALPHABET[bytes[i] % RESUME_CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function uniqueResumeCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomResumeCode();
    const clash = await prisma.user.findUnique({ where: { resumeCode: code } });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique resume code after several tries.");
}

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { resumeCode: null },
    select: { id: true, displayName: true },
  });

  if (users.length === 0) {
    console.log("All users already have a resume code. Nothing to do.");
    return;
  }

  console.log(`Backfilling resume codes for ${users.length} user(s)...`);
  for (const u of users) {
    const code = await uniqueResumeCode();
    await prisma.user.update({
      where: { id: u.id },
      data: { resumeCode: code },
    });
    console.log(`  ${u.displayName}: ${code}`);
  }
  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
