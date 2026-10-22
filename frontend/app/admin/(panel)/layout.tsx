import { Suspense } from "react";

import { AdminShell } from "@/components/admin/shell/AdminShell";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { QueryProvider } from "@/components/admin/shell/QueryProvider";
import { AdminUserEmail, SessionGate } from "@/components/admin/shell/SessionGate";
import { Skeleton } from "@/components/admin/ui/skeleton";

/**
 * Every signed-in admin page. The sidebar/topbar frame is static; the session check reads the
 * cookie, so it sits behind Suspense (Cache Components) and gates the page content.
 */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <QueryProvider>
      <AdminShell
        user={
          <Suspense fallback={<Skeleton className="h-4 w-44" />}>
            <AdminUserEmail />
          </Suspense>
        }
      >
        <Suspense fallback={<LoadingState variant="list" label="Checking your session…" />}>
          <SessionGate>{children}</SessionGate>
        </Suspense>
      </AdminShell>
    </QueryProvider>
  );
}
