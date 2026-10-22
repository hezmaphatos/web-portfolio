import type { Metadata } from "next";

import { DashboardView } from "./DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

/** Server page for the metadata title; the dashboard itself is client-fetched (DashboardView). */
export default function DashboardPage() {
  return <DashboardView />;
}
