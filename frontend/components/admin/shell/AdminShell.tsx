import type { ReactNode } from "react";

import { AdminBrand } from "./AdminBrand";
import { AdminNav } from "./AdminNav";
import { AdminTopbar } from "./AdminTopbar";

type AdminShellProps = {
  /** Signed-in admin for the topbar. */
  user: ReactNode;
  children: ReactNode;
};

/** Sidebar (desktop) / sheet (mobile) + topbar + content column. */
export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="min-h-dvh">
      <a
        href="#admin-main"
        className="bg-background focus-visible:ring-ring/50 sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-3"
      >
        Skip to content
      </a>

      <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <AdminBrand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-60">
        <AdminTopbar user={user} />
        <main id="admin-main" tabIndex={-1} className="flex-1 outline-none">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
