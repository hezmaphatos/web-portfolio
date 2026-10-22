import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { DocumentTitle } from "./DocumentTitle";

type PageHeaderProps = {
  /** Page heading (the page's only <h1>); also sets the browser tab title. */
  title: string;
  description?: ReactNode;
  /** Buttons/links on the right (e.g. "Add project"). */
  actions?: ReactNode;
  /** Optional link above the title, e.g. `{ href: "/admin/projects", label: "Projects" }`. */
  back?: { href: string; label: string };
  className?: string;
};

export function PageHeader({ title, description, actions, back, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <DocumentTitle title={title} />
      <div className="min-w-0 space-y-1.5">
        {back && (
          <Link
            href={back.href}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-3"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
