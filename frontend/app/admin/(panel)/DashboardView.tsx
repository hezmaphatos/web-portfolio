"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Eye, Inbox, Plus, Swords } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { dashboardQueryOptions } from "@/components/admin/shell/dashboard-query";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import type { Dashboard } from "@/lib/types";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function DashboardView() {
  const query = useQuery(dashboardQueryOptions);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Content counts, recent messages and how visitors play the projects."
        actions={
          <Button asChild>
            <Link href="/admin/projects/new">
              <Plus aria-hidden="true" />
              Add project
            </Link>
          </Button>
        }
      />

      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load the dashboard"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <DashboardContent data={query.data} />
      )}
    </>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  const { counts } = data;
  const drafts = counts.projects - counts.published_projects;

  return (
    <div className="space-y-6">
      <section aria-labelledby="dashboard-counts">
        <h2 id="dashboard-counts" className="sr-only">
          Counts
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Projects"
            value={counts.projects}
            hint={`${numberFormat.format(drafts)} draft${drafts === 1 ? "" : "s"}`}
            href="/admin/projects"
          />
          <StatTile
            label="Published"
            value={counts.published_projects}
            hint="Live on the site"
            href="/admin/projects"
          />
          <StatTile
            label="Skills"
            value={counts.skills}
            hint="Incl. soft skills"
            href="/admin/skills"
          />
          <StatTile
            label="Messages"
            value={counts.messages}
            hint="All time"
            href="/admin/messages"
          />
          <StatTile
            label="Unread"
            value={counts.unread_messages}
            hint={counts.unread_messages > 0 ? "Waiting for a reply" : "Inbox zero"}
            href="/admin/messages?unread=1"
            highlight={counts.unread_messages > 0}
          />
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>
              <h2>Latest messages</h2>
            </CardTitle>
            <CardDescription>The 5 newest contact form messages.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/messages">
                  View all
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.latest_messages.length === 0 ? (
              <EmptyState
                compact
                icon={Inbox}
                title="No messages yet"
                description="Messages sent through the Contact chapter show up here."
              />
            ) : (
              <ul className="-my-2 divide-y">
                {data.latest_messages.map((message) => (
                  <li key={message.id} className="flex gap-3 py-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        message.read_at === null ? "bg-primary" : "bg-transparent",
                      )}
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{message.name}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {message.email}
                        </span>
                        {message.read_at === null && <Badge variant="secondary">Unread</Badge>}
                        <time
                          dateTime={message.created_at}
                          className="text-muted-foreground ml-auto text-xs tabular-nums"
                        >
                          {dateFormat.format(new Date(message.created_at))}
                        </time>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {message.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <RankedCard
            title="Most viewed projects"
            description="Project page views."
            unit="views"
            emptyTitle="No views yet"
            emptyIcon={Eye}
            items={data.most_viewed.map((project) => ({
              id: project.id,
              title: project.title,
              value: project.view_count,
            }))}
          />
          <RankedCard
            title="Most defeated bosses"
            description="Boss battles won by visitors."
            unit="defeats"
            emptyTitle="No bosses defeated yet"
            emptyIcon={Swords}
            items={data.most_defeated.map((project) => ({
              id: project.id,
              title: project.title,
              value: project.defeat_count,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "bg-card ring-foreground/10 hover:bg-muted/40 focus-visible:ring-ring/50 flex h-full flex-col gap-1 rounded-xl p-4 ring-1 transition-colors outline-none focus-visible:ring-3",
          highlight && "ring-primary/40",
        )}
      >
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {numberFormat.format(value)}
        </span>
        <span className="text-muted-foreground text-xs">
          {highlight && (
            <span
              aria-hidden="true"
              className="bg-primary mr-1.5 inline-block size-1.5 rounded-full align-middle"
            />
          )}
          {hint}
        </span>
      </Link>
    </li>
  );
}

type RankedItem = { id: number; title: string; value: number };

function RankedCard({
  title,
  description,
  unit,
  items,
  emptyTitle,
  emptyIcon,
}: {
  title: string;
  description: ReactNode;
  unit: string;
  items: RankedItem[];
  emptyTitle: string;
  emptyIcon: typeof Eye;
}) {
  const hasData = items.some((item) => item.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            compact
            icon={emptyIcon}
            title={emptyTitle}
            description="Counts appear once visitors start playing."
          />
        ) : (
          <ol className="-my-1 divide-y">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <span className="text-muted-foreground w-4 text-right text-xs tabular-nums">
                  {index + 1}
                </span>
                <Link
                  href={`/admin/projects/${item.id}`}
                  className="focus-visible:ring-ring/50 min-w-0 flex-1 truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
                >
                  {item.title}
                </Link>
                <span className="text-sm tabular-nums">
                  {numberFormat.format(item.value)}
                  <span className="text-muted-foreground"> {unit}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading the dashboard…</span>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="ring-foreground/10 space-y-2 rounded-xl p-4 ring-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
