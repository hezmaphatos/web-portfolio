import type { Metadata } from "next";

import { PasswordView } from "./PasswordView";

export const metadata: Metadata = { title: "Account" };

/** Server page for the metadata title; the change-password form is a client component. */
export default function AccountPage() {
  return <PasswordView />;
}
