import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = await prisma.user.findMany({ select: { id: true, username: true } });
const locations = await prisma.location.findMany({
  select: { id: true, activityName: true, countryName: true, userId: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});

console.log("users:", users);
console.log("locations:", locations.length);
for (const l of locations) {
  const u = users.find((x) => x.id === l.userId);
  console.log(`- [${u?.username}] ${l.activityName} (${l.countryName})`);
}

await prisma.$disconnect();
