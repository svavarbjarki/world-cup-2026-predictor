import { redirect } from "next/navigation";
import { isPasswordAuthed, getCurrentUser } from "@/lib/auth";

// Route protection lives here, in a server layout, rather than in Edge
// middleware. The auth checks need Prisma and node:crypto (to verify the
// per-user token and the signed password cookie), neither of which runs in the
// Edge runtime middleware uses. A layout check runs in the Node.js runtime, is
// simple, and every page in this (protected) group inherits it automatically.
// The redirects are server-side, so they are real enforcement, not UI hiding.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isPasswordAuthed())) {
    redirect("/login");
  }
  const user = await getCurrentUser();
  if (!user) {
    redirect("/name");
  }
  return <>{children}</>;
}
