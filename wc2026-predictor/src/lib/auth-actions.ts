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

/** Step 2: claim (or fail to claim) a display name. */
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
    // Name clash. Identity here is just a name, so we cannot prove this device
    // belongs to the original claimer. To avoid two different people silently
    // sharing one name, we reject rather than hand over the identity. The
    // original owner resumes automatically via their device cookie (the per-user
    // token); a genuine owner on a brand-new device must reuse their first
    // device or pick a different name.
    //
    // Tradeoff: no frictionless cross-device resume without the original cookie,
    // in exchange for zero silent identity collisions. That is the right call
    // for a small group of trusted friends and avoids building a real account
    // and recovery system.
    return { error: "That name is already taken. Pick another one." };
  }

  const token = generateUserToken();
  const user = await prisma.user.create({
    data: { displayName, sessionToken: token },
  });
  await setUserCookie(user.id, token);
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
