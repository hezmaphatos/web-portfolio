import { Gamepad2 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Panel name in the sidebar and the mobile sheet. */
export function AdminBrand({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      className={cn(
        "focus-visible:ring-sidebar-ring/60 flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3",
        className,
      )}
    >
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
        <Gamepad2 className="size-4" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">Hackker</span>
        <span className="text-muted-foreground text-xs">Portfolio admin</span>
      </span>
    </Link>
  );
}
