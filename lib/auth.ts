import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "wwz_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(value: string) {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(value);
  return hmac.digest("hex");
}

function makeToken() {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expires}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expires, signature] = parts;
  const payload = `${role}.${expires}`;
  const expected = sign(payload);
  const validSignature =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return false;
  if (Date.now() > Number(expires)) return false;
  return true;
}

export function checkPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function isAuthed() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token);
}
