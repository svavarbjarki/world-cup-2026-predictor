// Server-only auth helpers. This module reads SHARED_PASSWORD / AUTH_SECRET and
// touches Prisma and cookies, so it must never be imported into a Client
// Component (import only its TYPES from the client if needed). It runs in the
// Node.js runtime because it uses node:crypto and Prisma, which is also why
// route protection lives in a server layout rather than Edge middleware.

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Cookie that marks a session as having passed the shared-password gate. */
const PASSWORD_COOKIE = "wc_pw";
/** Cookie that identifies the current user as "<userId>.<secret token>". */
const USER_COOKIE = "wc_user";
/** Temporary cookie marking a new user who must view + confirm their resume code
 *  before entering the app. Same "<userId>.<token>" value shape as USER_COOKIE. */
const REVEAL_COOKIE = "wc_reveal";
/** Cookie that marks a session as organizer-authenticated for /admin. */
const ADMIN_COOKIE = "wc_admin";
/** Cookie lifetime: long enough to cover the whole tournament. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 120; // ~120 days

function requireEnv(
  name: "SHARED_PASSWORD" | "AUTH_SECRET" | "ADMIN_PASSWORD",
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to your .env (see .env.example).`);
  }
  return value;
}

/** Constant-time string comparison that also avoids throwing on length diff. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * The value stored in the password cookie. It is an HMAC keyed by AUTH_SECRET,
 * so a client cannot forge a valid cookie without knowing the server secret, and
 * the shared password itself is never placed in any cookie.
 */
function passwordCookieValue(): string {
  return createHmac("sha256", requireEnv("AUTH_SECRET"))
    .update("password-ok")
    .digest("hex");
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

/** Compare a submitted password to the shared password (server-side only). */
export function verifySharedPassword(submitted: string): boolean {
  return safeEqual(submitted, requireEnv("SHARED_PASSWORD"));
}

/** Has this request passed the shared-password gate? */
export async function isPasswordAuthed(): Promise<boolean> {
  const value = (await cookies()).get(PASSWORD_COOKIE)?.value;
  return value !== undefined && safeEqual(value, passwordCookieValue());
}

/** Mark the session as password-authenticated. Call only from a Server Action. */
export async function setPasswordCookie(): Promise<void> {
  (await cookies()).set(PASSWORD_COOKIE, passwordCookieValue(), baseCookieOptions());
}

/** Generate a fresh per-user secret token (the device resume secret). */
export function generateUserToken(): string {
  return randomBytes(32).toString("hex");
}

// Uppercase alphanumeric with the ambiguous characters removed (no 0, O, I, 1).
// Exactly 32 symbols, so a random byte taken modulo the length is unbiased.
const RESUME_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Build one candidate code: 8 symbols formatted as "XXXX-XXXX". */
function randomResumeCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += RESUME_CODE_ALPHABET[bytes[i] % RESUME_CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Generate a unique resume code (8 uppercase alphanumeric chars, no ambiguous
 * characters, formatted "XXXX-XXXX"). Checks the database and retries on the
 * astronomically unlikely collision. Uses crypto randomness, never Math.random.
 */
export async function generateResumeCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomResumeCode();
    const clash = await prisma.user.findUnique({ where: { resumeCode: code } });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique resume code after several tries.");
}

/**
 * Look up a user by their resume code. Input is normalized first (hyphens and
 * spaces dropped, uppercased) so user typos in spacing or case still match, since
 * stored codes are always the canonical "XXXX-XXXX" form. Returns the User or null.
 */
export async function verifyResumeCode(code: string): Promise<User | null> {
  const cleaned = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  if (cleaned.length !== 8) return null;
  const canonical = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  return prisma.user.findUnique({ where: { resumeCode: canonical } });
}

/** Identify the current user on this device. Call only from a Server Action. */
export async function setUserCookie(userId: string, token: string): Promise<void> {
  // userId and the secret token are stored together. The token is a random
  // per-user secret, so tampering with userId without the matching token fails
  // verification in getCurrentUser.
  (await cookies()).set(USER_COOKIE, `${userId}.${token}`, baseCookieOptions());
}

/**
 * Resolve a "<userId>.<token>" cookie value to a verified user, checking the
 * per-user token against the database. Returns null for any missing, malformed,
 * or non-matching value. Shared by the identity and reveal cookies.
 */
async function userFromCookieValue(raw: string | undefined): Promise<User | null> {
  if (!raw) return null;

  const separator = raw.indexOf(".");
  if (separator < 0) return null;
  const userId = raw.slice(0, separator);
  const token = raw.slice(separator + 1);
  if (!userId || !token) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.sessionToken) return null;
  if (!safeEqual(token, user.sessionToken)) return null;
  return user;
}

/**
 * Load the current user from the device cookie, verifying the per-user token
 * against the database. Returns null if there is no valid identity.
 */
export async function getCurrentUser(): Promise<User | null> {
  const user = await userFromCookieValue((await cookies()).get(USER_COOKIE)?.value);
  if (!user) return null;

  // Edge case: a pre-migration row the backfill missed has no resume code. Mint
  // one silently on this cookie-based login and persist it, so every active user
  // ends up with a recoverable code. The happy path (code already present) is
  // unchanged.
  if (!user.resumeCode) {
    const resumeCode = await generateResumeCode();
    return prisma.user.update({ where: { id: user.id }, data: { resumeCode } });
  }
  return user;
}

/**
 * Log out by clearing the shared-password gate only. The per-user identity token
 * (USER_COOKIE) is deliberately kept: it is the device's sole proof of identity
 * (there are no per-user passwords), so deleting it would lock the user out for
 * good. After this, the protected routes send them to /login, and re-entering the
 * shared password drops them straight back in as the same player. Call only from
 * a Server Action.
 */
export async function clearPasswordCookie(): Promise<void> {
  (await cookies()).delete(PASSWORD_COOKIE);
}

/**
 * Clear BOTH auth cookies, including the per-user identity token. This forgets
 * who the device is, which cannot be safely recovered (claiming an existing name
 * is rejected to prevent impersonation), so it is not used by the normal log-out
 * flow. Kept for a deliberate full reset. Call only from a Server Action.
 */
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(PASSWORD_COOKIE);
  store.delete(USER_COOKIE);
}

// ---------------------------------------------------------------------------
// First-registration resume-code reveal gate.
//
// After a brand new user registers we must show them their resume code once and
// make them confirm before they can use the app. We do NOT set the real identity
// cookie yet; instead we set this separate cookie (same verifiable
// "<userId>.<token>" value, but under a name the protected layout does not honor).
// The app therefore stays gated by the existing "no identity cookie" redirect
// until the user confirms, at which point we promote them to the real identity
// cookie and clear this one. A normal returning user never has this cookie, so
// they never see the reveal screen.
// ---------------------------------------------------------------------------

/** Mark a freshly registered user as awaiting resume-code confirmation. */
export async function setRevealCookie(userId: string, token: string): Promise<void> {
  (await cookies()).set(REVEAL_COOKIE, `${userId}.${token}`, baseCookieOptions());
}

/** Load the user awaiting code confirmation, or null when there is none. */
export async function getRevealUser(): Promise<User | null> {
  return userFromCookieValue((await cookies()).get(REVEAL_COOKIE)?.value);
}

/** Is a resume-code reveal currently pending on this device? */
export async function isRevealPending(): Promise<boolean> {
  return (await cookies()).get(REVEAL_COOKIE)?.value !== undefined;
}

/** Clear the reveal gate once the user has saved their code. */
export async function clearRevealCookie(): Promise<void> {
  (await cookies()).delete(REVEAL_COOKIE);
}

// ---------------------------------------------------------------------------
// Admin (organizer) gate. Single shared ADMIN_PASSWORD, no role system.
// ---------------------------------------------------------------------------

/** HMAC value stored in the admin cookie; unforgeable without AUTH_SECRET. */
function adminCookieValue(): string {
  return createHmac("sha256", requireEnv("AUTH_SECRET"))
    .update("admin-ok")
    .digest("hex");
}

/** Compare a submitted password to the admin password (server-side only). */
export function verifyAdminPassword(submitted: string): boolean {
  return safeEqual(submitted, requireEnv("ADMIN_PASSWORD"));
}

/** Is this request organizer-authenticated? */
export async function isAdminAuthed(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return value !== undefined && safeEqual(value, adminCookieValue());
}

/** Mark the session as admin-authenticated. Call only from a Server Action. */
export async function setAdminCookie(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, adminCookieValue(), baseCookieOptions());
}

/** Clear the admin cookie (admin log out). Call only from a Server Action. */
export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
