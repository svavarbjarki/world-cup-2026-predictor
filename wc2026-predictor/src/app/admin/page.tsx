import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminLoginForm } from "./admin-login-form";
import { AdminDashboard } from "./admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // The admin gate is independent of the player auth: /admin lives outside the
  // (protected) group, so only this organizer-password check applies. This is the
  // single login entry point; the other admin tools redirect here when not authed.
  if (!(await isAdminAuthed())) {
    return <AdminLoginForm />;
  }

  const users = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      groupStatus: true,
      knockoutStatus: true,
      awardsStatus: true,
      createdAt: true,
    },
  });

  return (
    <AdminDashboard
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
    />
  );
}
