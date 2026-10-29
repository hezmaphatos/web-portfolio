"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { ApiError, adminSend, errorMessage, firstErrors } from "@/lib/admin/api";
import type { AdminUser } from "@/lib/types";

const schema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(255, "That password is too long."),
});

type LoginInput = z.input<typeof schema>;
type LoginValues = z.output<typeof schema>;

/** Only same-site /admin paths are valid post-login destinations (no open redirect). */
function safeNext(next: string | null): string {
  if (!next) return "/admin";
  try {
    const url = new URL(next, window.location.origin);
    const inAdmin = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
    const isLogin = url.pathname === "/admin/login" || url.pathname.startsWith("/admin/login/");
    if (url.origin !== window.location.origin || !inAdmin || isLogin) return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.has("expired");

  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  // The layout sent us here because the cookie's token is dead: drop the stale cookie once.
  const cleared = useRef(false);
  useEffect(() => {
    if (!expired || cleared.current) return;
    cleared.current = true;
    void fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
  }, [expired]);

  async function onSubmit(values: LoginValues) {
    try {
      await adminSend<{ user: AdminUser }>("POST", "login", values);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setError("root", { message: "Too many attempts, try again in a minute." });
        return;
      }
      const fields = firstErrors(error);
      if (fields.email || fields.password) {
        if (fields.email) setError("email", { message: fields.email }, { shouldFocus: true });
        if (fields.password) setError("password", { message: fields.password });
        return;
      }
      setError("root", { message: errorMessage(error) });
      return;
    }

    // A full load, not router.replace: the client router may still hold the RSC payload of the
    // pre-login visit to /admin (proxy.ts redirected it here) and would replay that redirect.
    window.location.replace(safeNext(searchParams.get("next")));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {expired && !errors.root && (
        <p role="status" className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
          Your session has ended. Please sign in again.
        </p>
      )}
      {errors.root?.message && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {errors.root.message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          {...register("email")}
        />
        {errors.email?.message && (
          <p id="login-email-error" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "login-password-error" : undefined}
          {...register("password")}
        />
        {errors.password?.message && (
          <p id="login-password-error" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
