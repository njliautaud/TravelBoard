import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const drafts = await prisma.draft.findMany({
  orderBy: { createdAt: "desc" },
  include: { user: { select: { username: true } } },
});
console.log(JSON.stringify(drafts, null, 2));
await prisma.$disconnect();
