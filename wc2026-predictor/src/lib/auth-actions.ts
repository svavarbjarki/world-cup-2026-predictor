"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { AuthActionState } from "@/lib/auth-types";
import {
  verifySharedPassword,
  setPasswordCookie,
  isPasswordAuthed,
  getCurrentUser,
  setUserCookie,
  generateUserToken,
  clearPasswordCookie,
  generateResumeCode,
  verifyResumeCode,
  setRevealCookie,
  getRevealUser,
  clearRevealCookie,
} from "@/lib/auth";

/** Step 1: check the shared password and open the gate. */
export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  if (!verifySharedPassword(password)) {
    return { error: "That password is not right. Ask the organizer." };
  }
  await setPasswordCookie();
  // redirect throws, so it sits outside any try/catch.
  redirect("/name");
}

/**
 * Step 2A ("I am new"): claim a display name and register a new user. Generates a
 * resume code, then sends the user to the one-time code reveal screen. We do NOT
 * set the real identity cookie yet; we set the reveal cookie instead, so the app
 * stays gated until they confirm they saved the code (see /welcome).
 */
export async function claimNameAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  // Server-side enforcement: never trust that the page guarded this.
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }
  if (await getCurrentUser()) {
    // Already identified on this device; nothing to claim.
    redirect("/");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2 || displayName.length > 30) {
    return { error: "Pick a name between 2 and 30 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { displayName } });
  if (existing) {
    // Name clash. A returning player should use the "I am returning" resume-code
    // option instead, which proves identity. We reject blind name reuse so two
    // different people can never silently share one name (and so nobody can take
    // over another player's predictions just by typing their name).
    return { error: "That name is already taken. If it is you, use your resume code." };
  }

  const token = generateUserToken();
  const resumeCode = await generateResumeCode();
  const user = await prisma.user.create({
    data: { displayName, sessionToken: token, resumeCode },
  });
  await setRevealCookie(user.id, token);
  redirect("/welcome");
}

/**
 * Step 2B ("I am returning"): log in with a resume code. Looks the user up by
 * code (case- and hyphen-insensitive), sets the identity cookie, and sends them
 * straight into the app. No name entry and no code reveal.
 */
export async function resumeAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }
  if (await getCurrentUser()) {
    redirect("/");
  }

  const code = String(formData.get("resumeCode") ?? "");
  const user = await verifyResumeCode(code);
  if (!user) {
    return { error: "That resume code did not match. Check it and try again." };
  }

  // The identity cookie verifies against the stored sessionToken, so make sure
  // the user has one (older rows may not).
  let token = user.sessionToken;
  if (!token) {
    token = generateUserToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionToken: token },
    });
  }
  await setUserCookie(user.id, token);
  redirect("/");
}

/**
 * Step 3: the new user confirms they have saved their resume code. Promote the
 * pending reveal identity to the real identity cookie, clear the reveal gate, and
 * let them into the app.
 */
export async function confirmCodeAction(): Promise<void> {
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }
  const user = await getRevealUser();
  if (!user || !user.sessionToken) {
    // Nothing pending (already confirmed, or no reveal). Fall through to the app,
    // where the normal cookie checks decide what they can see.
    redirect("/");
  }
  await setUserCookie(user.id, user.sessionToken);
  await clearRevealCookie();
  redirect("/");
}

/**
 * Log out by dropping the shared-password gate, but keep the per-user identity
 * token so the player can come back. Re-entering the shared password lands them
 * straight back on the dashboard as the same user. We do not clear the identity
 * token because there is no way to safely reclaim an existing name afterwards
 * (that is blocked to prevent impersonation in this prediction pool), so clearing
 * it would lock the user out permanently.
 */
export async function logoutAction(): Promise<void> {
  await clearPasswordCookie();
  redirect("/login");
}
