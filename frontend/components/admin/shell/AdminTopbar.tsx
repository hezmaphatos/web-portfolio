"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/admin/ui/sheet";

import { AdminBrand } from "./AdminBrand";
import { AdminNav } from "./AdminNav";
import { findNavItem } from "./nav";

type AdminTopbarProps = {
  /** Signed-in admin (server-rendered behind Suspense in the panel layout). */
  user: ReactNode;
};

export function AdminTopbar({ user }: AdminTopbarProps) {
  return (
    <header className="bg-background sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 md:px-6">
      <MobileNav />
      <Suspense fallback={null}>
        <SectionTitle />
      </Suspense>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="text-muted-foreground hidden min-w-0 truncate text-sm md:block">{user}</div>
        <Button variant="outline" size="sm" asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            View site <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
        <LogoutButton />
      </div>
    </header>
  );
}

/** The topbar's page-title slot: the current section, derived from the URL. */
function SectionTitle() {
  const pathname = usePathname();
  const label = findNavItem(pathname)?.label;
  if (!label) return null;
  return <p className="truncate text-sm font-medium">{label}</p>;
}

function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar w-72 gap-0 p-0" aria-describedby={undefined}>
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AdminBrand onNavigate={() => setOpen(false)} />
        </SheetHeader>
        <div className="overflow-y-auto p-3">
          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
    } catch {
      // Offline: the cookie may survive, but the login page is still the right place to go.
    }
    queryClient.clear();
    router.replace("/admin/login");
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={pending}>
      <LogOut aria-hidden="true" />
      <span className="hidden sm:inline">Log out</span>
      <span className="sr-only sm:hidden">Log out</span>
    </Button>
  );
}
