import { redirect, unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";

import { getAdminUser } from "@/lib/admin/session";
import type { AdminUser } from "@/lib/types";

import { SessionUnavailable } from "./SessionUnavailable";

/**
 * Server-side session check for every panel page (proxy.ts only checks that the cookie exists).
 * Reads cookies, so it must render inside <Suspense> (Cache Components). A dead token goes to
 * /admin/login?expired=1, which proxy.ts lets through and which clears the stale cookie.
 */
export async function SessionGate({ children }: { children: ReactNode }) {
  let user: AdminUser | null;
  try {
    user = await getAdminUser();
  } catch (error) {
    // Let Next's own control flow through: during prerender `connection()` postpones this
    // subtree by rejecting, and that must not be mistaken for an API outage.
    unstable_rethrow(error);
    console.error("[admin] session check failed", error);
    return <SessionUnavailable />;
  }

  if (!user) redirect("/admin/login?expired=1");

  return <>{children}</>;
}

/** The signed-in admin's email for the topbar (same request-deduped lookup as SessionGate). */
export async function AdminUserEmail() {
  const user = await getAdminUser().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!user) return null;
  return (
    <span title={user.name}>
      <span className="sr-only">Signed in as </span>
      {user.email}
    </span>
  );
}
