import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminBrand } from "@/components/admin/shell/AdminBrand";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/admin/ui/card";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <AdminBrand />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <CardDescription>Manage the content of the portfolio.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams (next, expired) → client-rendered behind Suspense. */}
          <Suspense
            fallback={<LoadingState variant="form" rows={2} label="Loading the sign-in form…" />}
          >
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
