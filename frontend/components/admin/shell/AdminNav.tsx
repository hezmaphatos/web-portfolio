"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";

import { Badge } from "@/components/admin/ui/badge";
import { cn } from "@/lib/utils";

import { dashboardQueryOptions } from "./dashboard-query";
import { ADMIN_NAV, findNavItem } from "./nav";

type AdminNavProps = {
  /** Called after a link is chosen (closes the mobile sheet). */
  onNavigate?: () => void;
};

/**
 * Sidebar links. `usePathname` suspends while prerendering pages with unknown dynamic params
 * (e.g. /admin/projects/[id]), so the active-state list sits behind Suspense and the fallback
 * is the same list without an active item.
 */
export function AdminNav({ onNavigate }: AdminNavProps) {
  return (
    <Suspense fallback={<NavList activeHref={null} onNavigate={onNavigate} />}>
      <ActiveNavList onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavList({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  return <NavList activeHref={findNavItem(pathname)?.href ?? null} onNavigate={onNavigate} />;
}

function NavList({ activeHref, onNavigate }: AdminNavProps & { activeHref: string | null }) {
  const hydrated = useHydrated();

  return (
    <nav aria-label="Admin">
      <ul className="flex flex-col gap-0.5">
        {ADMIN_NAV.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors outline-none",
                  "focus-visible:ring-sidebar-ring/60 focus-visible:ring-3",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {item.unreadBadge && hydrated && <UnreadBadge />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const noop = () => () => {};

/** false during SSR/prerender and hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * Unread count from the shared dashboard query, refreshed every minute for new messages.
 * Mounted only after hydration: a query in the prerendered shell may read the clock, which
 * Cache Components rejects during prerendering (and the count needs a client fetch anyway).
 */
function UnreadBadge() {
  const { data: unread = 0 } = useQuery({
    ...dashboardQueryOptions,
    select: (dashboard) => dashboard.counts.unread_messages,
    refetchInterval: 60_000,
  });
  if (unread <= 0) return null;

  return (
    <Badge className="ml-auto tabular-nums">
      {unread > 99 ? "99+" : unread}
      <span className="sr-only"> unread</span>
    </Badge>
  );
}
