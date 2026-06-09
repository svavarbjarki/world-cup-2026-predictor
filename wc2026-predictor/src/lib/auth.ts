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

/** Identify the current user on this device. Call only from a Server Action. */
export async function setUserCookie(userId: string, token: string): Promise<void> {
  // userId and the secret token are stored together. The token is a random
  // per-user secret, so tampering with userId without the matching token fails
  // verification in getCurrentUser.
  (await cookies()).set(USER_COOKIE, `${userId}.${token}`, baseCookieOptions());
}

/**
 * Load the current user from the device cookie, verifying the per-user token
 * against the database. Returns null if there is no valid identity.
 */
export async function getCurrentUser(): Promise<User | null> {
  const raw = (await cookies()).get(USER_COOKIE)?.value;
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

/** Clear both auth cookies (log out). Call only from a Server Action. */
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(PASSWORD_COOKIE);
  store.delete(USER_COOKIE);
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
