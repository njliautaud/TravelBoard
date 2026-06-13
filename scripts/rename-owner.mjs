/**
 * One-off: rename owner account william -> swann and ensure password is "asdf".
 * Run: node scripts/rename-owner.mjs
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("asdf", 10);
  const existing =
    (await prisma.user.findUnique({ where: { username: "william" } })) ??
    (await prisma.user.findUnique({ where: { username: "swann" } }));

  if (!existing) {
    await prisma.user.create({ data: { username: "swann", passwordHash } });
    console.log('Created user "swann" (password: asdf)');
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { username: "swann", passwordHash },
  });
  console.log('Updated account to username "swann" (password: asdf)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
