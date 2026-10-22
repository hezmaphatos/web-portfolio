import { Suspense } from "react";

import { MessagesInbox } from "@/components/admin/messages/MessagesInbox";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";

/**
 * Inbox for the Contact form (spec §7 Messages). The view state (?unread=1, ?q=, ?page=,
 * ?message=<id>) is read with useSearchParams, hence the Suspense boundary around it.
 */
export default function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Messages sent through the Contact form, newest first. Opening one marks it as read."
      />
      <Suspense fallback={<LoadingState variant="list" rows={6} label="Loading messages…" />}>
        <MessagesInbox />
      </Suspense>
    </>
  );
}
