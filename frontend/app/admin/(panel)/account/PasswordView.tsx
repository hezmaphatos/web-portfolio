"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { adminSend, errorMessage, firstErrors } from "@/lib/admin/api";

/** Same limits as the API (UpdatePasswordRequest): 12–72 characters, bcrypt reads 72 bytes. */
const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(72, "Use at most 72 characters."),
    password_confirmation: z.string().min(1, "Repeat the new password."),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ["password_confirmation"],
    error: "The passwords don't match.",
  })
  .refine((values) => values.password !== values.current_password, {
    path: ["password"],
    error: "The new password must be different from the current one.",
  });

type PasswordValues = z.infer<typeof schema>;
type FieldName = keyof PasswordValues;

const FIELDS: readonly FieldName[] = ["current_password", "password", "password_confirmation"];

const EMPTY: PasswordValues = { current_password: "", password: "", password_confirmation: "" };

export function PasswordView() {
  const form = useForm<PasswordValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = form;

  const mutation = useMutation({
    mutationFn: (values: PasswordValues) => adminSend<{ ok: true }>("PUT", "password", values),
    onSuccess: () => {
      toast.success("Password updated. Other signed-in sessions were signed out.");
      reset(EMPTY);
    },
    onError: (error) => {
      const fields = firstErrors(error);
      let focused = false;
      for (const name of FIELDS) {
        const message = fields[name];
        if (!message) continue;
        setError(name, { message }, { shouldFocus: !focused });
        focused = true;
      }
      if (!focused) toast.error(errorMessage(error));
    },
  });

  return (
    <>
      <PageHeader title="Account" description="Security settings for the admin account." />

      <Card className="max-w-xl">
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <CardHeader>
            <CardTitle>
              <h2>Change password</h2>
            </CardTitle>
            <CardDescription>
              Use 12–72 characters. Changing it signs out every other session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Hidden username helps password managers pair the new password with the account. */}
            <input type="text" name="username" autoComplete="username" hidden readOnly />
            <PasswordField
              id="current_password"
              label="Current password"
              autoComplete="current-password"
              error={errors.current_password?.message}
              registration={register("current_password")}
            />
            <PasswordField
              id="password"
              label="New password"
              autoComplete="new-password"
              hint="12–72 characters."
              error={errors.password?.message}
              registration={register("password")}
            />
            <PasswordField
              id="password_confirmation"
              label="Confirm new password"
              autoComplete="new-password"
              error={errors.password_confirmation?.message}
              registration={register("password_confirmation")}
            />
          </CardContent>
          <CardFooter className="mt-4 justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Update password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  hint,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...registration}
      />
      {hint && !error && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
