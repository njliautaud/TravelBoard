import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "tb_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.SESSION_SECRET ?? "insecure-dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string): string {
  const expires = String(Date.now() + SESSION_TTL_MS);
  const payload = `${expires}.${userId}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const [expires, userId] = payload.split(".");
  if (!expires || !userId) return null;
  if (Number(expires) < Date.now()) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export async function getSessionUser(): Promise<{ id: string; username: string } | null> {
  const store = await cookies();
  const userId = parseSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  return user;
}

/** @deprecated use getSessionUser */
export async function isEditor(): Promise<boolean> {
  return (await getSessionUser()) !== null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < 3 || u.length > 32) return "Username must be 3–32 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Username may only contain letters, numbers, and underscores";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 4) return "Password must be at least 4 characters";
  return null;
}

export { SESSION_COOKIE, SESSION_TTL_MS };
