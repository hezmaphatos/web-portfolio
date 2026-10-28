import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { AdminBodyTheme } from "@/components/admin/shell/AdminBodyTheme";
import { Toaster } from "@/components/admin/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-admin", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Admin · Yehezkiel Natanael", template: "%s · Admin · Yehezkiel Natanael" },
  robots: { index: false, follow: false, nocache: true },
};

/** Admin root: shadcn tokens (scoped to .admin-theme in globals.css), Geist, toasts. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const themeClass = cn("admin-theme", geist.variable);

  return (
    <div className={cn(themeClass, "min-h-dvh antialiased")}>
      <AdminBodyTheme className={themeClass} />
      {children}
      <Toaster position="top-right" closeButton />
    </div>
  );
}
